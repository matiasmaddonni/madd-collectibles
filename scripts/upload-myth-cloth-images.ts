import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * MADD. Collectibles — Myth Cloth Image Fetcher & Uploader
 * 
 * This script:
 * 1. Fetches official product images from tamashiiweb.com
 * 2. Uploads them to your Supabase Storage bucket
 * 3. Links them to the correct product in product_images table
 * 
 * SETUP:
 * 1. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local
 *    (Find it in Supabase Dashboard → Settings → API → service_role key)
 * 2. Run: npx ts-node scripts/upload-myth-cloth-images.ts
 */

import { createClient } from '@supabase/supabase-js';

// Uses service role key — never expose this publicly
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapping: product slug → tamashiiweb.com product page URL
// These are the official product pages for your Myth Cloth stock
const MYTH_CLOTH_SOURCES: Record<string, string> = {
  'sagittarius-aiolos-sog':     'https://tamashiiweb.com/item/13372/?wovn=en',
  'garuda-aiacos-oce':          'https://tamashiiweb.com/item/13893/?wovn=en',
  'aries-mu-oce':               'https://tamashiiweb.com/item/13891/?wovn=en',
  'griffon-minos-oce':          'https://tamashiiweb.com/item/13895/?wovn=en',
  'hypnos':                     'https://tamashiiweb.com/item/11877/?wovn=en',
  'cancer-cloth':               'https://tamashiiweb.com/item/14128/?wovn=en',
  'aquarius-cloth':             'https://tamashiiweb.com/item/14130/?wovn=en',
  'libra-cloth':                'https://tamashiiweb.com/item/14348/?wovn=en',
  'aries-cloth':                'https://tamashiiweb.com/item/14126/?wovn=en',
  'geminis-cloth-kanon':        'https://tamashiiweb.com/item/14347/?wovn=en',
  'virgo-shaka':                'https://tamashiiweb.com/item/11134/?wovn=en',
  'siren-sorrento':             'https://tamashiiweb.com/item/14218/?wovn=en',
  'limnades-casa':              'https://tamashiiweb.com/item/14349/?wovn=en',
  'whale-moses':                'https://tamashiiweb.com/item/11133/?wovn=en',
  'wyvern-surplice':            'https://tamashiiweb.com/item/10037/?wovn=en',
  'andromeda-shun-v2':          'https://tamashiiweb.com/item/12836/?wovn=en',
  'marine-steel-cloth':         'https://tamashiiweb.com/item/15219/?wovn=en',
  'land-steel-cloth':           'https://tamashiiweb.com/item/15220/?wovn=en',
  'sky-steel-cloth':            'https://tamashiiweb.com/item/15218/?wovn=en',
  'centaurus-babel':            'https://tamashiiweb.com/item/10045/?wovn=en',
  'auriga-capella':             'https://tamashiiweb.com/item/10044/?wovn=en',
  'unicorn-cloth':              'https://tamashiiweb.com/item/10036/?wovn=en',
};

async function getImageUrlFromProductPage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl);
    const html = await res.text();
    // Extract first product image — pattern: /images/item/item_XXXXXXXXXX_XXXXXXXX_01.jpg
    const match = html.match(/\/images\/item\/item_\d+_\w+_01\.jpg/);
    if (match) return `https://tamashiiweb.com${match[0]}`;
    return null;
  } catch (e) {
    console.error(`  Failed to fetch page: ${pageUrl}`, e);
    return null;
  }
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error(`  Failed to download image: ${url}`, e);
    return null;
  }
}

async function uploadToSupabase(
  slug: string,
  imageBuffer: Buffer
): Promise<string | null> {
  const path = `myth-cloth/${slug}.jpg`;
  
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true, // overwrite if exists
    });

  if (error) {
    console.error(`  Upload failed for ${slug}:`, error.message);
    return null;
  }

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(path);

  return data.publicUrl;
}

async function linkImageToProduct(slug: string, imageUrl: string) {
  // Get product id by slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    console.error(`  Product not found for slug: ${slug}`);
    return;
  }

  // Insert into product_images
  const { error } = await supabase
    .from('product_images')
    .upsert({
      product_id: product.id,
      url: imageUrl,
      is_primary: true,
      sort_order: 0,
      alt: slug.replace(/-/g, ' '),
    }, { onConflict: 'product_id' });

  if (error) console.error(`  DB insert failed for ${slug}:`, error.message);
}

async function main() {
  console.log('🔥 MADD. Image Uploader — Myth Cloth\n');
  
  const slugs = Object.keys(MYTH_CLOTH_SOURCES);
  let success = 0;

  for (const slug of slugs) {
    const pageUrl = MYTH_CLOTH_SOURCES[slug];
    process.stdout.write(`📦 ${slug}... `);

    // 1. Get image URL from product page
    const imageUrl = await getImageUrlFromProductPage(pageUrl);
    if (!imageUrl) { console.log('❌ image URL not found'); continue; }

    // 2. Download the image
    const buffer = await downloadImage(imageUrl);
    if (!buffer) { console.log('❌ download failed'); continue; }

    // 3. Upload to Supabase Storage
    const publicUrl = await uploadToSupabase(slug, buffer);
    if (!publicUrl) { console.log('❌ upload failed'); continue; }

    // 4. Link to product in DB
    await linkImageToProduct(slug, publicUrl);

    console.log(`✅ done`);
    success++;

    // Small delay to be respectful to tamashiiweb.com
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n✅ Complete: ${success}/${slugs.length} images uploaded`);
}

main().catch(console.error);
