"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadProductImage,
  setPrimaryImage,
  deleteProductImage,
} from "../actions";

export type ImageRow = {
  id: string;
  url: string;
  is_primary: boolean;
};

export function ProductImagesEditor({
  productId,
  productSlug,
  images,
}: {
  productId: string;
  productSlug: string;
  images: ImageRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function maybeConvertHeic(file: File): Promise<File> {
    const isHeic =
      /^image\/(heic|heif)$/i.test(file.type) ||
      /\.(heic|heif)$/i.test(file.name);
    if (!isHeic) return file;
    // Lazy-load heic2any so the ~50 KB decoder doesn't ship to non-iOS users.
    const { default: heic2any } = await import("heic2any");
    const blob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const outBlob = Array.isArray(blob) ? blob[0] : blob;
    const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
    return new File([outBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      let firstUpload = images.length === 0;
      for (const original of files) {
        const file = await maybeConvertHeic(original);
        const fd = new FormData();
        fd.set("productId", productId);
        fd.set("productSlug", productSlug);
        fd.set("isPrimary", firstUpload ? "true" : "false");
        fd.set("file", file);
        await uploadProductImage(fd);
        firstUpload = false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Images</h2>

      {images.length === 0 && (
        <p className="text-sm text-zinc-600">No images yet.</p>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img) => (
          <li
            key={img.id}
            className="border border-zinc-300 p-2 flex flex-col gap-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              className="w-full aspect-square object-cover bg-zinc-100"
            />
            <div className="flex items-center justify-between text-xs">
              <span>{img.is_primary ? "★ Primary" : ""}</span>
              <div className="flex gap-2">
                {!img.is_primary && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await setPrimaryImage({
                          productId,
                          imageId: img.id,
                        });
                      })
                    }
                    className="text-blue-700 hover:underline"
                  >
                    Set primary
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Delete this image?")) return;
                    startTransition(async () => {
                      await deleteProductImage({
                        productId,
                        imageId: img.id,
                        url: img.url,
                      });
                    });
                  }}
                  className="text-red-700 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Upload images</span>
        <div className="flex items-center gap-3 flex-wrap">
          <label
            htmlFor="product-image-input"
            className={`inline-flex items-center gap-2 px-4 py-2 border border-zinc-400 rounded-sm bg-white text-sm font-medium hover:bg-zinc-100 active:bg-zinc-200 cursor-pointer select-none ${
              uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Elegir imágenes
          </label>
          <input
            id="product-image-input"
            ref={fileInputRef}
            type="file"
            // Broad accept so iOS surfaces the gallery (HEIC photos), Android
            // shows all gallery items, and desktop file pickers don't filter
            // unfamiliar formats. Type validation happens server-side.
            accept="image/*"
            multiple
            onChange={onUpload}
            disabled={uploading}
            className="sr-only"
          />
          {uploading && <p className="text-sm text-zinc-600">Subiendo…</p>}
        </div>
        <p className="text-xs text-zinc-600">
          JPEG, PNG, WEBP, AVIF. HEIC del iPhone se convierten automáticamente.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
