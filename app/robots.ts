import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API는 색인할 것이 없고, 오답 연습은 기기마다 내용이 다르다.
      disallow: ["/api/", "/review/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
