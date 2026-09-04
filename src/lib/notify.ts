/** Optional Telegram ping when a weekly report is ready. No-op if unset. */
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error("[notify] telegram failed:", err);
  }
}

/** Public base URL for building report links (VOC_PUBLIC_URL, else Vercel's). */
export function publicBaseUrl(): string {
  const explicit = (process.env.VOC_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || "").trim();
  return vercel ? `https://${vercel}` : "";
}

export function reportUrl(reportId: string): string {
  const base = publicBaseUrl();
  return `${base}/reports/${reportId}`;
}
