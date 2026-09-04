import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Voice of Customer",
  description: "Weekly voice-of-customer reports from your Fathom sales calls.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#faf9f7",
          color: "#1a1a1a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
