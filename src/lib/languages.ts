/**
 * Languages offered in the snippet editor. `value` is stored in the DB and
 * doubles as the Prism grammar key for syntax highlighting.
 */
export const snippetLanguages = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "TSX" },
  { value: "jsx", label: "JSX" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "markdown", label: "Markdown" },
  { value: "plaintext", label: "Plain text" },
] as const;

export type SnippetLanguage = (typeof snippetLanguages)[number]["value"];

export const languageValues = snippetLanguages.map((item) => item.value);

export function languageLabel(value: string): string {
  return snippetLanguages.find((item) => item.value === value)?.label ?? value;
}
