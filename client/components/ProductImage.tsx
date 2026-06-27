"use client";

import { useState } from "react";
import { toDirectDriveUrl } from "../lib/driveUrl";

export default function ProductImage({
  src,
  alt,
  className = "",
  icon,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  icon?: string;
}) {
  const [error, setError] = useState(false);
  const directSrc = src ? toDirectDriveUrl(src) : src;

  if (!error && directSrc && (directSrc.startsWith("http") || directSrc.startsWith("data:"))) {
    return (
      <img
        src={directSrc}
        alt={alt}
        className={`h-full w-full object-cover ${className}`}
        loading="lazy"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <span className={`flex items-center justify-center ${className}`}>
      {icon || src || alt.charAt(0).toUpperCase()}
    </span>
  );
}
