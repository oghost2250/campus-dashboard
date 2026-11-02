import { prisma } from "@/lib/prisma";
import { notFound, requireUserId, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const CHUNK_SIZE = 256 * 1024;

/** Files are stored as data URLs; older rows may hold bare base64. */
function decodeFile(
  stored: string,
  fallbackType: string,
): { bytes: Uint8Array; mime: string } | null {
  let mime = fallbackType || "application/octet-stream";
  let base64 = stored;

  if (stored.startsWith("data:")) {
    const comma = stored.indexOf(",");
    if (comma === -1) return null;
    const header = stored.slice(5, comma);
    base64 = stored.slice(comma + 1);
    const [type, ...params] = header.split(";");
    if (type) mime = type;
    if (!params.includes("base64")) return null;
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return null;
  return { bytes, mime };
}

function contentDisposition(title: string) {
  const safe = title.replace(/[^\w.\- ]+/g, "_").trim() || "material";
  const ascii = safe.replace(/[^\x20-\x7e]+/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function streamOf(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        controller.enqueue(bytes.subarray(offset, offset + CHUNK_SIZE));
      }
      controller.close();
    },
  });
}

export async function GET(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const row = await prisma.studyMaterial.findUnique({
    where: { id },
    select: {
      userId: true,
      privacy: true,
      title: true,
      fileType: true,
      fileData: true,
    },
  });

  // Private materials of other accounts are indistinguishable from missing
  // ones, so their existence never leaks.
  if (!row || (row.privacy !== "public" && row.userId !== userId)) {
    return notFound();
  }

  const decoded = decodeFile(row.fileData, row.fileType);
  if (!decoded) return notFound();

  const { bytes, mime } = decoded;
  const total = bytes.length;
  const etag = `"${id}-${total}"`;

  const headers = new Headers({
    "Content-Type": mime,
    "Content-Disposition": contentDisposition(row.title),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;

      if (start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }

      const slice = bytes.subarray(start, end + 1);
      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      headers.set("Content-Length", String(slice.length));
      return new Response(streamOf(slice), { status: 206, headers });
    }
  }

  headers.set("Content-Length", String(total));
  return new Response(streamOf(bytes), { status: 200, headers });
}
