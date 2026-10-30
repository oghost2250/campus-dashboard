/**
 * Browser persistence helpers.
 *
 * Study-hub material images are base64 data URLs. localStorage caps out at
 * ~5 MB, which a couple of scans exhaust; IndexedDB has a much larger quota and
 * does not block the main thread. The first read migrates any legacy
 * localStorage payload automatically.
 */

const DB_NAME = "campus-store";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function withStore(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const value = await withStore("readonly", (store) => store.get(key));
  return (value as T) ?? null;
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const result = await withStore("readwrite", (store) =>
    store.put(value, key),
  );
  return result !== null;
}

/**
 * Reads a JSON payload from IndexedDB, falling back to (and migrating from)
 * localStorage for data written before the IndexedDB upgrade.
 */
export async function loadPersisted<T>(key: string): Promise<T | null> {
  const stored = await idbGet<T>(key);
  if (stored != null) return stored;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    await idbSet(key, parsed);
    window.localStorage.removeItem(key);
    return parsed;
  } catch {
    return null;
  }
}

/** Persists a value, silently degrading to localStorage if IDB is blocked. */
export async function savePersisted(key: string, value: unknown): Promise<boolean> {
  const ok = await idbSet(key, value);
  if (ok) return true;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the image."));
    image.src = source;
  });
}

/**
 * Shrinks a captured/uploaded page before it is stored or embedded in a PDF.
 * Phone cameras produce 4000px+ images that make PDFs unuploadable on Vercel.
 */
export async function downscaleImage(
  source: string,
  maxDimension = 1600,
  quality = 0.72,
): Promise<string> {
  if (!source.startsWith("data:image/")) return source;

  try {
    const image = await loadImage(source);
    const longest = Math.max(image.width, image.height);
    const scale = Math.min(1, maxDimension / longest);
    if (scale >= 1 && source.length < 900_000) return source;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) return source;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return source;
  }
}
