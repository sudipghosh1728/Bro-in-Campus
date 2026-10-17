import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/settings/", "/bookmarks", "/notifications"] },
    sitemap: "https://broincampus.in/sitemap.xml",
  };
}
