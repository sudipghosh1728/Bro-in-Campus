import { prisma } from "./prisma";
import { slugify } from "./slug";

const feeds = [
  ["EDUCATION", "higher education India"],
  ["ECONOMY", "India economy students"],
  ["ENGINEERING", "engineering innovation India"],
  ["TECHNOLOGY", "emerging technology India"],
] as const;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function tag(item: string, name: string) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1]) : null;
}

async function refreshCategory(category: string, query: string) {
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const response = await fetch(feedUrl, { cache: "no-store", headers: { "User-Agent": "BroInCampusBriefing/1.0" } });
  if (!response.ok) throw new Error(`News feed responded ${response.status}`);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 3).flatMap((match) => {
    const title = tag(match[1], "title");
    const sourceUrl = tag(match[1], "link");
    if (!title || !sourceUrl) return [];
    return [{ title, sourceUrl }];
  });
  await Promise.all(items.map(async ({ title, sourceUrl }) => {
    const slug = `live-${category.toLowerCase()}-${slugify(title)}`.slice(0, 100);
    await prisma.newsBriefing.upsert({
      where: { slug },
      create: { title, slug, summary: "Open the linked source for the complete update and verify the details that matter to you.", category, sourceName: "Google News", sourceUrl, publishedAt: new Date(), featured: false },
      update: { title, sourceUrl, publishedAt: new Date() },
    });
  }));
  return items.length;
}

export async function refreshStudentBriefing() {
  const results = await Promise.allSettled(feeds.map(([category, query]) => refreshCategory(category, query)));
  const updated = results.reduce((total, result) => total + (result.status === "fulfilled" ? result.value : 0), 0);
  const failures = results.filter((result) => result.status === "rejected").length;
  if (!updated && failures) throw new Error("All briefing feeds were unavailable.");
  return { updated, failedCategories: failures };
}
