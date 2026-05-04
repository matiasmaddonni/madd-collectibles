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

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      let firstUpload = images.length === 0;
      for (const file of files) {
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

      <div className="flex flex-col gap-1">
        <label className="text-sm">Upload images</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onUpload}
          disabled={uploading}
        />
        {uploading && <p className="text-sm text-zinc-600">Uploading…</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
