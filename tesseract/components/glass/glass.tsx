"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

interface GlassContextValue {
  register: (element: HTMLElement) => () => void;
  refresh: () => void;
}

const GlassContext = createContext<GlassContextValue | null>(null);

function isChromium(): boolean {
  if (typeof navigator === "undefined") return false;
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string }> };
    }
  ).userAgentData?.brands;
  if (brands?.some((brand) => /Chromium|Google Chrome|Microsoft Edge/.test(brand.brand))) {
    return true;
  }
  return /Chrome\//.test(navigator.userAgent) && !/Firefox|Safari\//.test(navigator.userAgent);
}

function finePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function token(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isFinite(value) ? value : fallback;
}

/**
 * A rounded-rectangle signed-distance field. Neutral in the middle; the
 * displacement is strongest inside the bezel. This is the portfolio's map,
 * unchanged, so the app's glass optics match it exactly.
 */
function displacementMap(
  width: number,
  height: number,
  radius: number,
  bezel: number,
  cache: Map<string, string>,
): string {
  const cacheKey = `${width}x${height}:${radius.toFixed(2)}:${bezel}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const scale = Math.min(1, 420 / Math.max(width, height));
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  const band = Math.max(1, bezel * scale);
  const r = Math.min(radius * scale, Math.min(w, h) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(w, h);
  const data = image.data;

  const sdf = (x: number, y: number): number => {
    const qx = Math.abs(x - w / 2) - (w / 2 - r);
    const qy = Math.abs(y - h / 2) - (h / 2 - r);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      r
    );
  };

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = (y * w + x) * 4;
      const distance = sdf(x + 0.5, y + 0.5);
      const inside = distance < 0 ? Math.min(1, -distance / band) : 0;
      const bend = (1 - inside) * (1 - inside);

      let nx = sdf(x + 1.5, y + 0.5) - sdf(x - 0.5, y + 0.5);
      let ny = sdf(x + 0.5, y + 1.5) - sdf(x + 0.5, y - 0.5);
      const length = Math.hypot(nx, ny) || 1;
      nx /= length;
      ny /= length;

      data[index] = 128 - nx * bend * 127;
      data[index + 1] = 128 - ny * bend * 127;
      data[index + 2] = 128;
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL("image/png");
  if (cache.size > 64) cache.clear();
  cache.set(cacheKey, url);
  return url;
}

function buildFilter(
  element: HTMLElement,
  id: string,
  lens: { strength: number; bezel: number; chroma: number },
  cache: Map<string, string>,
): string {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return "";
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const computedRadius = Number.parseFloat(
    getComputedStyle(element).borderTopLeftRadius,
  );
  const radius = Math.max(
    1,
    Math.min(
      Number.isFinite(computedRadius) ? computedRadius : 32,
      height / 2,
    ),
  );
  const map = displacementMap(width, height, radius, lens.bezel, cache);
  if (!map) return "";
  const scale = lens.strength;
  const fringe = Math.max(0.5, scale * 0.05 * lens.chroma);

  return `
    <filter id="${id}" x="0" y="0" width="${width}" height="${height}"
      filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB">
      <feImage href="${map}" x="0" y="0" width="${width}" height="${height}"
        preserveAspectRatio="none" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale + fringe}"
        xChannelSelector="R" yChannelSelector="G" result="dr" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}"
        xChannelSelector="R" yChannelSelector="G" result="dg" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale - fringe}"
        xChannelSelector="R" yChannelSelector="G" result="db" />
      <feColorMatrix in="dr" type="matrix"
        values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="r" />
      <feColorMatrix in="dg" type="matrix"
        values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="g" />
      <feColorMatrix in="db" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1" result="b" />
      <feBlend in="r" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="b" mode="screen" />
    </filter>`;
}

export function GlassProvider({ children }: { children: ReactNode }) {
  const elements = useRef(new Set<HTMLElement>());
  const svgRef = useRef<SVGSVGElement>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);
  const observers = useRef(new Map<HTMLElement, ResizeObserver>());
  const mapCache = useRef(new Map<string, string>());

  const rebuild = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    for (const element of elements.current) {
      element.style.removeProperty("--glass-use");
      delete element.dataset.lens;
    }
    svg.innerHTML = "";

    if (!isChromium() || !finePointer()) return;
    if (
      !CSS.supports("backdrop-filter", "url(#x)") &&
      !CSS.supports("-webkit-backdrop-filter", "url(#x)")
    ) {
      return;
    }

    const lens = {
      strength: token("--glass-refraction", 48),
      bezel: token("--glass-bezel", 22),
      chroma: token("--glass-chroma", 0.5),
    };

    let markup = "";
    const applied: Array<{ element: HTMLElement; id: string }> = [];
    for (const element of elements.current) {
      if (!element.isConnected) continue;
      const id = `glass-lens-${counter.current++}`;
      const filter = buildFilter(element, id, lens, mapCache.current);
      if (!filter) continue;
      markup += filter;
      applied.push({ element, id });
    }

    if (!markup) return;
    svg.innerHTML = markup;
    for (const { element, id } of applied) {
      element.style.setProperty(
        "--glass-use",
        `url(#${id}) blur(var(--glass-blur)) saturate(1.4)`,
      );
      element.dataset.lens = id;
    }
  }, []);

  const schedule = useCallback(
    (delay = 180) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        rebuild();
      }, delay);
    },
    [rebuild],
  );

  const register = useCallback(
    (element: HTMLElement): (() => void) => {
      elements.current.add(element);
      const observer = new ResizeObserver(() => schedule());
      observer.observe(element);
      observers.current.set(element, observer);
      schedule(0);

      return () => {
        observer.disconnect();
        observers.current.delete(element);
        elements.current.delete(element);
        schedule(0);
      };
    },
    [schedule],
  );

  useEffect(() => {
    let queued = 0;
    let pointer: { x: number; y: number } | null = null;

    const paintSheen = () => {
      queued = 0;
      if (!pointer) return;
      for (const element of elements.current) {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        // Only the panel under the pointer needs a new sheen. Writing the two
        // custom properties on every glass element repaints all of them.
        if (
          pointer.x < rect.left ||
          pointer.x > rect.right ||
          pointer.y < rect.top ||
          pointer.y > rect.bottom
        ) {
          continue;
        }
        const x = ((pointer.x - rect.left) / rect.width) * 100;
        const y = ((pointer.y - rect.top) / rect.height) * 100;
        element.style.setProperty("--mx", `${x.toFixed(2)}%`);
        element.style.setProperty("--my", `${y.toFixed(2)}%`);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!queued) queued = requestAnimationFrame(paintSheen);
    };

    const onResize = () => schedule();
    const onGlassRefresh = () => schedule(0);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("tesseract:glass", onGlassRefresh);
    void document.fonts?.ready.then(() => schedule(0)).catch(() => undefined);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("tesseract:glass", onGlassRefresh);
      if (queued) cancelAnimationFrame(queued);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [schedule]);

  return (
    <GlassContext.Provider value={{ register, refresh: () => schedule(0) }}>
      {children}
      <svg
        aria-hidden="true"
        focusable="false"
        id="filter-defs"
        ref={svgRef}
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      />
    </GlassContext.Provider>
  );
}

export function Glass({
  children,
  className = "",
  innerClassName = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  innerClassName?: string;
}) {
  const context = useContext(GlassContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!context || !ref.current) return;
    return context.register(ref.current);
  }, [context]);

  return (
    <div ref={ref} className={`glass ${className}`.trim()} {...rest}>
      <div className={`glass-inner ${innerClassName}`.trim()}>{children}</div>
    </div>
  );
}

export function useGlassRefresh(): () => void {
  const context = useContext(GlassContext);
  return context?.refresh ?? (() => undefined);
}
