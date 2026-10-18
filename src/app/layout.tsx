import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/app/actions";
import { Shell } from "@/components/shell/Shell";
import { PwaRegister } from "@/components/PwaRegister";
import { BRAND, siteUrl } from "@/lib/brand";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: BRAND.name,
  title: { default: BRAND.title, template: `%s | ${BRAND.name}` },
  description: BRAND.description,
  // The share images (opengraph-image.png, twitter-image.png) and icons (icon.png, apple-icon.png, favicon.ico) are picked up from this folder by Next's file conventions.
  openGraph: { siteName: BRAND.name, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  appleWebApp: { title: BRAND.name, capable: true, statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: BRAND.themeColor.light }, { media: "(prefers-color-scheme: dark)", color: BRAND.themeColor.dark }] };

// Runs before paint so the saved theme never flashes. Falls back to the OS setting.
// The collapsed-sidebar preference is restored here too, so the rail never flashes open on load.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}try{if(localStorage.getItem("sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <PwaRegister />
        <Shell user={user ? { username: user.username, role: user.role } : null} logout={logout}>{children}</Shell>
      </body>
    </html>
  );
}
