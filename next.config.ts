import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The app registers public/sw.js itself. The generated worker is written
// beside that file and is not auto-registered.
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false,
  sw: "next-pwa-sw.js",
  cacheOnFrontEndNav: false,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  reloadOnOnline: false,
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "pdf-lib", "@pdf-lib/fontkit", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withPWA(withNextIntl(nextConfig));
