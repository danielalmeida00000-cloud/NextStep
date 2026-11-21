import { useEffect, useState } from "react";
import { previewPathPrefix } from "@/lib/preview-path-prefix";

const FILE = "/car-poster-pro-extension.zip";
const NAME = "car-poster-pro-extension.zip";

function extensionPath(): string {
  if (typeof window === "undefined") return FILE;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
  return `${prefix}${FILE}`;
}

export function ExtensionDownload({ children, prominent = false }: { children: string; prominent?: boolean }) {
  const [href, setHref] = useState(FILE);

  useEffect(() => {
    const path = extensionPath();
    setHref(`${window.location.origin}${path}`);
  }, []);

  if (prominent) {
    return (
      <div className="text-right">
        <a
          className="inline-flex min-h-11 items-center rounded-full bg-amber px-4 text-sm font-semibold text-ink"
          href={href}
          download={NAME}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
        <p className="mt-1 max-w-[16rem] break-all text-left text-xs text-muted sm:text-right">{href}</p>
      </div>
    );
  }

  return (
    <a className="text-amber underline" href={href} download={NAME} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
