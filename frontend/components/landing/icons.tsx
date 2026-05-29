"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/* Shared iconography (Lucide-style 2px stroke, rounded caps).
   Ported from the Claude Design handoff (js/icons.jsx). The marketing
   landing page keeps this self-contained set; the command center uses
   Phosphor icons. */

type IconProps = {
  name: string;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
};

export function Icon({ name, size = 20, stroke = 2, style, className }: IconProps) {
  const paths: Record<string, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    arrowUR: (
      <>
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 6 10-6" />
      </>
    ),
    whatsapp: (
      <>
        <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5Z" />
        <path d="M8.5 8.8c.3 3 2.7 5.4 5.7 5.7.5 0 1-.4 1.1-.9l.2-.8-2-.9-.8.8a5 5 0 0 1-2.2-2.2l.8-.8-.9-2-.8.2c-.5.1-.9.6-.9 1.1Z" />
      </>
    ),
    discord: (
      <>
        <path d="M8 6c-2 .4-4 1.2-4 1.2C2.8 10 2.5 13 2.7 16c0 0 2 1.6 4 2l.8-1.6" />
        <path d="M16 6c2 .4 4 1.2 4 1.2 1.2 2.8 1.5 5.8 1.3 8.8 0 0-2 1.6-4 2L16.5 16" />
        <path d="M8.5 16c2.3 1 4.7 1 7 0" />
        <circle cx="9.5" cy="12" r="1" />
        <circle cx="14.5" cy="12" r="1" />
      </>
    ),
    check: <path d="m5 12 5 5L20 7" />,
    checkCircle: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.3 2.3 4.7-4.7" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
    link: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </>
    ),
    gauge: (
      <>
        <path d="M12 14 8 9" />
        <circle cx="12" cy="13" r="9" />
        <path d="M12 13h.01" />
      </>
    ),
    doc: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </>
    ),
    power: (
      <>
        <path d="M12 4v8" />
        <path d="M7 7a8 8 0 1 0 10 0" />
      </>
    ),
    swap: (
      <>
        <path d="M16 3l4 4-4 4" />
        <path d="M20 7H8" />
        <path d="M8 21l-4-4 4-4" />
        <path d="M4 17h12" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    brightdata: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M7.5 12a4.5 4.5 0 0 1 9 0 4.5 4.5 0 0 1-9 0Z" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      </>
    ),
    radar: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" opacity="0.55" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <path
          d="M12 12 12 3a9 9 0 0 1 7.8 4.5Z"
          fill="currentColor"
          opacity="0.28"
          stroke="none"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </path>
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    quote: (
      <>
        <path d="M9 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2" />
        <path d="M19 6h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2" />
      </>
    ),
    activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        <path d="M3 21v-5h5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  );
}

/* Filled Sekreativ sparkle (the brand's only proprietary mark) */
export function Sparkle({
  size = 16,
  color,
  style,
  className,
}: {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M60 0 C 62 38 64 56 120 60 C 64 64 62 82 60 120 C 58 82 56 64 0 60 C 56 56 58 38 60 0 Z"
        fill={color || "currentColor"}
      />
    </svg>
  );
}

/* Pulse wordmark — lowercase, tight, sparkle accent */
export function Wordmark({ size = 23 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      pulse
      <Sparkle className="spk" />
    </span>
  );
}

/* Brand logo image with graceful fallback */
export function BrandImg({
  src,
  alt,
  fallback = null,
  ...rest
}: {
  src?: string;
  alt?: string;
  fallback?: ReactNode;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  const [err, setErr] = useState(false);
  if (err || !src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)} {...rest} />;
}

/* Vendor logo via Google favicon service with icon fallback */
export function VendorLogo({ domain, size = 18 }: { domain: string; size?: number }) {
  return (
    <BrandImg
      src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 4, display: "block", flex: "none", objectFit: "contain" }}
      fallback={<Icon name="database" size={size} />}
    />
  );
}
