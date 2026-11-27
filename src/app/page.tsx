import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/authorization";
import type { Metadata, Viewport } from "next";
import "./landing-page.css";

export const instant = false;

const pageTitle = "Evalify: online examination platform for examiners";
const pageDescription =
  "Online examinations for examiners and candidates. Set server-timed attempts and issue verifiable result reports.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    type: "website",
    images: ["/share.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/share.jpg"],
  },
  other: {
    "page-type": "software",
    "site-kind": "software",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef0f3",
};

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));
  return <LandingPage />;
}
