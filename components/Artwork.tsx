"use client";

import Image from "next/image";
import React from "react";

type ArtworkProps = {
  className?: string;
  alt?: string;
  priority?: boolean;
};

export default function Artwork({ className, alt = "Artwork", priority = false }: ArtworkProps) {
  // Renders the optimized SVG from public using next/image for layout/styling convenience
  return (
    <Image
      src="/artwork.min.svg"
      alt={alt}
      width={768}
      height={439}
      priority={priority}
      className={className}
    />
  );
}
