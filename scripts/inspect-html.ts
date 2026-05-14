import * as cheerio from "cheerio";
import { fetchText } from "./crawl/http";

// Throwaway: dump the structural bits of a product page so we can write
// a parser. Usage: npx tsx scripts/inspect-html.ts <url>

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: inspect-html.ts <url>");
    process.exit(1);
  }
  const html = await fetchText(url, { browserLike: true });
  if (!html) {
    console.log("FETCH FAILED (null)");
    return;
  }
  console.log(`HTML length: ${html.length}`);
  const $ = cheerio.load(html);

  console.log("\n=== <title> ===");
  console.log("  " + $("title").first().text().trim());

  console.log("\n=== meta og:* / description ===");
  $('meta[property^="og:"], meta[name="description"], meta[name="twitter:image"]').each(
    (_, el) => {
      const key = $(el).attr("property") ?? $(el).attr("name");
      const val = ($(el).attr("content") ?? "").slice(0, 160);
      console.log(`  ${key} = ${val}`);
    },
  );

  console.log("\n=== JSON-LD blocks ===");
  $('script[type="application/ld+json"]').each((i, el) => {
    console.log(`  [${i}] ${$(el).contents().text().slice(0, 400)}`);
  });

  console.log("\n=== dl / dt-dd pairs ===");
  $("dl").each((i, dl) => {
    console.log(`  dl[${i}] class="${$(dl).attr("class") ?? ""}"`);
    $(dl)
      .find("dt")
      .each((_, dt) => {
        const k = $(dt).text().replace(/\s+/g, " ").trim();
        const v = $(dt).next("dd").text().replace(/\s+/g, " ").trim();
        console.log(`     ${k} :: ${v}`);
      });
  });

  console.log("\n=== table rows ===");
  $("table").each((i, t) => {
    console.log(`  table[${i}] class="${$(t).attr("class") ?? ""}"`);
    $(t)
      .find("tr")
      .slice(0, 12)
      .each((_, tr) => {
        const cells = $(tr)
          .find("th,td")
          .map((_, c) => $(c).text().replace(/\s+/g, " ").trim())
          .get();
        if (cells.some(Boolean)) console.log(`     ${cells.join(" :: ")}`);
      });
  });

  console.log("\n=== headings (h1-h3) ===");
  $("h1,h2,h3").slice(0, 25).each((_, h) => {
    const tag = (h as { tagName?: string }).tagName;
    console.log(`  <${tag} class="${$(h).attr("class") ?? ""}"> ${$(h).text().replace(/\s+/g, " ").trim().slice(0, 80)}`);
  });

  console.log("\n=== candidate description paragraphs ===");
  $("p").each((_, p) => {
    const t = $(p).text().replace(/\s+/g, " ").trim();
    if (t.length > 60) {
      console.log(`  class="${$(p).attr("class") ?? ""}" :: ${t.slice(0, 180)}`);
    }
  });

  console.log("\n=== img srcs (first 30, filtered) ===");
  const seen = new Set<string>();
  $("img").each((_, im) => {
    const src = $(im).attr("src") ?? $(im).attr("data-src") ?? "";
    if (!src || seen.has(src)) return;
    seen.add(src);
    if (seen.size <= 30) console.log(`  ${src}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
