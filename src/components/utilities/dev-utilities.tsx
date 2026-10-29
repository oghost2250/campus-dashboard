"use client";

import { useMemo, useState } from "react";
import {
  Binary,
  Braces,
  Check,
  Copy,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const jsonExample = `{"student":"Layla Hassan","courses":[{"code":"CS 340","grade":"A-","credits":3},{"code":"MATH 241","grade":"A","credits":4}],"gpa":3.78}`;

function parseInBase(raw: string, base: number): bigint | null {
  let value = raw.trim().toLowerCase().replace(/_/g, "");
  if (!value) return null;

  let sign = BigInt(1);
  if (value.startsWith("-") || value.startsWith("+")) {
    if (value.startsWith("-")) sign = BigInt(-1);
    value = value.slice(1);
  }

  if (base === 16) value = value.replace(/^0x/, "");
  if (base === 2) value = value.replace(/^0b/, "");
  if (base === 10) value = value.replace(/^0d/, "");
  if (!value) return null;

  const valid =
    base === 16 ? /^[0-9a-f]+$/ : base === 2 ? /^[01]+$/ : /^[0-9]+$/;
  if (!valid.test(value)) return null;

  let result = BigInt(0);
  for (const character of value) {
    result = result * BigInt(base) + BigInt(parseInt(character, 16));
  }
  return sign * result;
}

export function DevUtilities() {
  const { t } = useI18n();

  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [base, setBase] = useState("10");
  const [value, setValue] = useState("255");

  const parsed = useMemo(() => parseInBase(value, Number(base)), [value, base]);

  const outputs = useMemo(() => {
    if (parsed === null) return [];
    return [
      { id: "dec", label: t.utilities.decimal, value: parsed.toString(10) },
      { id: "hex", label: t.utilities.hexadecimal, value: parsed.toString(16).toUpperCase() },
      { id: "bin", label: t.utilities.binary, value: parsed.toString(2) },
    ];
  }, [parsed, t.utilities.decimal, t.utilities.hexadecimal, t.utilities.binary]);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(t.common.copied);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error(t.common.error);
    }
  }

  function transformJson(mode: "format" | "minify") {
    if (!json.trim()) return;
    try {
      const parsedJson: unknown = JSON.parse(json);
      const next = JSON.stringify(parsedJson, null, mode === "format" ? 2 : 0);
      setJson(next);
      setJsonError(null);
    } catch (error) {
      setJsonError(
        error instanceof Error ? error.message : t.utilities.invalidJson,
      );
    }
  }

  function changeBase(next: string) {
    const current = parseInBase(value, Number(base));
    if (current !== null) setValue(current.toString(Number(next)));
    setBase(next);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.utilities.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.utilities.subtitle}</p>
      </div>

      <Tabs defaultValue="json" className="gap-4">
        <TabsList className="h-9 rounded-xl">
          <TabsTrigger value="json" className="gap-1.5 rounded-lg px-3">
            <Braces className="size-3.5" />
            {t.utilities.jsonTab}
          </TabsTrigger>
          <TabsTrigger value="base" className="gap-1.5 rounded-lg px-3">
            <Binary className="size-3.5" />
            {t.utilities.baseTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="json" className="space-y-3">
          <section className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-soft backdrop-blur-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => transformJson("format")}
                disabled={!json.trim()}
              >
                <Wand2 className="size-3.5" />
                {t.utilities.format}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                onClick={() => transformJson("minify")}
                disabled={!json.trim()}
              >
                <Braces className="size-3.5" />
                {t.utilities.minify}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                onClick={() => {
                  setJson(jsonExample);
                  setJsonError(null);
                }}
              >
                {t.utilities.example}
              </Button>
              <div className="ms-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg"
                  onClick={() => copyText(json, "json")}
                  disabled={!json.trim()}
                >
                  {copied === "json" ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {t.common.copy}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg text-muted-foreground"
                  onClick={() => {
                    setJson("");
                    setJsonError(null);
                  }}
                  disabled={!json}
                  aria-label={t.common.clear}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <Textarea
              value={json}
              onChange={(event) => {
                setJson(event.target.value);
                if (jsonError) setJsonError(null);
              }}
              placeholder={t.utilities.jsonPlaceholder}
              dir="ltr"
              spellCheck={false}
              rows={16}
              className="min-h-[280px] resize-y rounded-xl font-mono text-[12.5px] leading-relaxed"
            />

            <p
              className={cn(
                "mt-2 min-h-4 text-[11px]",
                jsonError ? "text-destructive" : "text-muted-foreground",
              )}
              role={jsonError ? "alert" : undefined}
            >
              {jsonError ?? t.utilities.jsonHint}
            </p>
          </section>
        </TabsContent>

        <TabsContent value="base" className="space-y-3">
          <section className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-soft backdrop-blur-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <div className="space-y-1.5">
                <Label htmlFor="base-input">{t.utilities.value}</Label>
                <Input
                  id="base-input"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  dir="ltr"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="255"
                  className="h-11 rounded-xl font-mono text-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.utilities.inputBase}</Label>
                <Select value={base} onValueChange={changeBase}>
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">{t.utilities.decimal} (10)</SelectItem>
                    <SelectItem value="16">{t.utilities.hexadecimal} (16)</SelectItem>
                    <SelectItem value="2">{t.utilities.binary} (2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              {parsed === null ? t.utilities.invalidNumber : t.utilities.baseHint}
            </p>

            <div className="mt-4 space-y-2">
              {outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <span className="w-28 shrink-0 text-[11px] font-medium text-muted-foreground">
                    {output.label}
                  </span>
                  <code
                    dir="ltr"
                    className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px]"
                  >
                    {output.value}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-md"
                    onClick={() => copyText(output.value, output.id)}
                    aria-label={`${t.common.copy} ${output.label}`}
                  >
                    {copied === output.id ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "255", base: "10" },
                { label: "FF", base: "16" },
                { label: "1010 1010", base: "2" },
              ].map((sample) => (
                <Button
                  key={sample.label}
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-md font-mono text-[11px]"
                  onClick={() => {
                    setBase(sample.base);
                    setValue(sample.label.replace(/\s/g, ""));
                  }}
                >
                  {sample.label}
                </Button>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
