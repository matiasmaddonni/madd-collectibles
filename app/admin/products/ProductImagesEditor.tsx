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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="ah-h3" style={{ fontSize: 16 }}>Images</h2>

      {images.length === 0 && (
        <p className="ah-small ah-dim">No images yet.</p>
      )}

      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {images.map((img) => (
          <li
            key={img.id}
            style={{
              border: "1px solid var(--ah-border)",
              borderRadius: 6,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "var(--ah-surface)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                background: "var(--ah-surface-2)",
                borderRadius: 4,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
              }}
            >
              <span style={{ color: img.is_primary ? "var(--ah-ok)" : "var(--ah-text-3)", fontWeight: 600 }}>
                {img.is_primary ? "★ Primary" : ""}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
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
                    className="ah-link"
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
                  className="ah-link ah-link--danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="ah-form-label">Upload images</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label
            htmlFor="product-image-input"
            className="ah-btn"
            style={{
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.5 : 1,
              pointerEvents: uploading ? "none" : "auto",
            }}
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
            accept="image/*"
            multiple
            onChange={onUpload}
            disabled={uploading}
            className="sr-only"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          />
          {uploading && <p className="ah-small ah-dim">Subiendo…</p>}
        </div>
        <p className="ah-small ah-dim">
          JPEG, PNG, WEBP, AVIF. HEIC del iPhone se convierten automáticamente.
        </p>
        {error && (
          <p
            style={{
              fontSize: 13,
              padding: "8px 12px",
              background: "var(--ah-danger-bg)",
              color: "var(--ah-danger)",
              borderRadius: 4,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
