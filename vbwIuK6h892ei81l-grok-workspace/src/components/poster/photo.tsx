import { useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/cn";

export function Photo({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-2 text-muted", className)}>
        <span className="flex flex-col items-center gap-1 text-xs">
          <Camera className="size-5" aria-hidden="true" />
          No photo
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      onError={() => setOk(false)}
    />
  );
}
