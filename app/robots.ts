import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API는 색인할 것이 없고, 오답 연습은 기기마다 내용이 다르다.
      // /admin은 도구다. 열쇠가 있어야 아무것도 안 보이지만, 색인될 이유도 없다.
      disallow: ["/api/", "/review/", "/admin"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
