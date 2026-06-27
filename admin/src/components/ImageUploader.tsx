import { useState } from "react";
import { toDirectDriveUrl } from "../utils/driveUrl";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  gasUrl?: string;
  driveFolderId?: string;
}

export default function ImageUploader({ images, onChange, max = 5, gasUrl = "", driveFolderId = "" }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const addUrl = () => {
    const url = prompt("Paste Google Drive image URL:");
    if (url && url.trim()) {
      onChange([...images, url.trim()]);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!gasUrl) {
      addUrl();
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const res = await fetch(gasUrl, {
        method: "POST",
        body: JSON.stringify({ action: "uploadImage", data: base64, fileName: file.name, folderId: driveFolderId || undefined }),
      });
      const text = await res.text();
      var parsed;
      try { parsed = JSON.parse(text); } catch {}
      var driveUrl;
      if (parsed?.success && parsed?.data?.url) {
        driveUrl = parsed.data.url;
      } else if (text.startsWith("http")) {
        driveUrl = text;
      } else {
        throw new Error(parsed?.error || text || "Upload failed");
      }
      onChange([...images, driveUrl]);
    } catch (err) {
      alert("Upload failed. Paste a Drive URL instead.");
    } finally {
      setUploading(false);
    }
  };

  const remove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...images];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  return (
    <div>
      <h3 className="mb-3 font-heading font-semibold text-text">
        Images ({images.length}/{max})
      </h3>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-beige/30">
            {url.startsWith("http") ? (
              <img src={toDirectDriveUrl(url)} alt={`Product ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl">{url}</div>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {i > 0 && <button onClick={() => moveUp(i)} className="rounded bg-white/80 px-1 text-xs text-text hover:bg-white">←</button>}
              <button onClick={() => remove(i)} className="rounded bg-white/80 px-1 text-xs text-error hover:bg-white">✕</button>
            </div>
          </div>
        ))}
        {images.length < max && (
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border bg-beige/20">
            <label className="flex cursor-pointer flex-col items-center gap-1 text-xs text-text-muted">
              <span className="text-lg">📷</span>
              <span>Upload</span>
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
            </label>
          </div>
        )}
        {images.length < max && (
          <button onClick={addUrl} type="button" className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border text-2xl text-text-muted transition-colors hover:border-forest-green hover:text-forest-green">
            🔗
          </button>
        )}
      </div>
      {uploading && <p className="mt-2 text-xs text-text-muted">Uploading to Drive...</p>}
    </div>
  );
}
