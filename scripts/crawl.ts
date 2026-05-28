#!/usr/bin/env tsx
import { loadEnv } from "./crawl/env";
import { run, type RunnerOptions } from "./crawl/runner";

loadEnv();

function parseArgs(argv: string[]): RunnerOptions {
  const opts: RunnerOptions = { apply: false };
  for (const a of argv.slice(2)) {
    if (a === "--apply") opts.apply = true;
    else if (a === "--dry-run") opts.apply = false;
    else if (a === "--force") opts.force = true;
    else if (a.startsWith("--slug=")) opts.slug = a.slice("--slug=".length);
    else if (a.startsWith("--line=")) opts.line = a.slice("--line=".length);
    else if (a.startsWith("--missing="))
      opts.missing = a.slice("--missing=".length);
    else if (a.startsWith("--source="))
      opts.source = a.slice("--source=".length);
    else if (a.startsWith("--batch="))
      opts.batch = a.slice("--batch=".length);
    else if (a.startsWith("--status=")) {
      const v = a.slice("--status=".length);
      if (v === "draft" || v === "available" || v === "all") {
        opts.status = v;
      } else {
        console.warn(`Unknown --status value: ${v} (use draft|available|all)`);
      }
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) opts.limit = Math.floor(n);
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`Unknown flag: ${a}`);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/crawl.ts [flags]

Flags:
  --slug=<slug>      Crawl only this product slug
  --line=<slug>      Crawl all products in this line
  --missing=<field>  Only products where <field> is null/empty
                     (description, release_year, tags, price)
  --source=<names>   Comma-separated adapter names (tamashii,fandom,ebay)
  --batch=<name>     Only crawl slugs grouped under this batch in the
                     tamashii-overrides "_batches" map (e.g. dbs-super-hero)
  --status=<which>   Limit scope by products.status: draft (default when
                     no --slug/--line/--batch), available, or all.
  --limit=<n>        Cap number of products processed
  --dry-run          (default) Log proposals, write nothing
  --apply            Persist proposals + upload candidate images
  --force            Re-crawl even if pending data already exists for
                     this product/source (default skips to save API quota)
`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const result = await run(opts);
  console.log(
    `\nDone. products=${result.productsScanned} ` +
      `fieldsProposed=${result.fieldsProposed} ` +
      `imagesProposed=${result.imagesProposed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
