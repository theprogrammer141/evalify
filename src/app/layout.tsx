import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { FeedbackProvider } from "@/components/feedback-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Evalify",
  title: "Evalify | Online Examination Platform",
  description:
    "Secure access for examination administrators, examiners and candidates.",
  icons: {
    icon: "/evalify-mark.png",
    apple: "/evalify-mark.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-type="software"
      data-radius="soft"
      data-buttons="tonal"
      data-ground="sand"
      data-motion="live"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col">
        <Script id="landing-motion-entry" strategy="beforeInteractive">
          {`if (window.location.pathname === "/") {
  document.documentElement.classList.add("m-enter");
  window.setTimeout(() => document.documentElement.classList.add("m-enter-done"), 700);
}`}
        </Script>
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
