"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

export interface QrCodeProps {
  /** Text to encode — here, an absolute invite URL. */
  value: string;
  /** Rendered edge length in CSS pixels. */
  size?: number;
  /** Accessible name. Required: a code with no text alternative is unreadable to a screen reader. */
  label: string;
  className?: string;
}

/** Quiet zone mandated by the QR spec, in modules. Scanners rely on it to find the symbol. */
const QUIET_ZONE_MODULES = 4;

/**
 * Renders `value` as an inline SVG QR code.
 *
 * Inline SVG rather than the library's `createDataURL` / `createImgTag`: those
 * rasterise through a canvas, which neither server rendering nor jsdom
 * provides, so the component would be untestable and would blank out in SSR.
 */
export function QrCode({ value, size = 160, label, className }: QrCodeProps) {
  const { path, extent } = useMemo(() => {
    // Type number 0 picks the smallest version the data fits into. Level 'M'
    // (~15% recovery) is the usual choice for a code displayed on screen rather
    // than printed, where smudging and tearing are not a concern.
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const segments: string[] = [];
    // One horizontal run per stretch of dark modules rather than one rect per
    // module: identical picture, roughly an order of magnitude less markup.
    for (let row = 0; row < count; row += 1) {
      let runStart = -1;
      for (let col = 0; col <= count; col += 1) {
        const isDark = col < count && qr.isDark(row, col);
        if (isDark && runStart === -1) runStart = col;
        if (!isDark && runStart !== -1) {
          const width = col - runStart;
          const x = runStart + QUIET_ZONE_MODULES;
          const y = row + QUIET_ZONE_MODULES;
          segments.push(`M${x} ${y}h${width}v1h-${width}z`);
          runStart = -1;
        }
      }
    }

    return { path: segments.join(""), extent: count + QUIET_ZONE_MODULES * 2 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      // Module edges are meant to be hard. Antialiasing them costs contrast at
      // the sizes this renders at, which is exactly what a scanner measures.
      shapeRendering="crispEdges"
      className={className}
    >
      {/*
        Fixed black-on-white rather than theme colours: an inverted code is
        outside the spec and a number of scanners reject it outright. The
        surrounding card carries the theme instead.
      */}
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
