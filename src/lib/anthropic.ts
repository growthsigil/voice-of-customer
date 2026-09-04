/**
 * Thin wrapper around the Anthropic SDK that returns parsed JSON. Streams the
 * response (so a large report never hits an HTTP timeout) and tolerantly
 * extracts the JSON object from the model's text output.
 */
import Anthropic from "@anthropic-ai/sdk";

export const ANALYSIS_MODEL = process.env.VOC_ANALYSIS_MODEL || "claude-opus-5";
export const REPORT_MODEL = process.env.VOC_REPORT_MODEL || "claude-opus-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/** Pull the first balanced JSON object/array out of a string (handles code
 *  fences and any stray prose the model adds around it). */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) return null;
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Ask the model for JSON and return it parsed. Throws on an unusable response so
 * the caller can mark the item failed and retry later.
 */
export async function generateJSON<T = unknown>(params: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<T> {
  const stream = anthropic().messages.stream({
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();
  const json = extractJson(text);
  if (!json) throw new Error("model did not return JSON");
  return JSON.parse(json) as T;
}
