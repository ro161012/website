"use client";

import { useEffect, useRef, useState } from "react";
import * as starfield from "ascii.rest/pieces/starfield";

const FPS = 24;

/**
 * The ascii.rest starfield, mounted as page furniture behind the glass.
 *
 * It renders the piece itself instead of using ascii.rest's mount loop: mount
 * stops while the Page Visibility API says the page is hidden, which is what
 * the embedded preview reports even when it is on screen. A timer keeps the
 * field moving there, and the app's own Reduce motion setting still freezes it.
 */
export function AsciiBackdrop() {
  const ref = useRef<HTMLPreElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setReduceMotion(root.dataset.reduceMotion === "true");
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const frame = starfield.default({ stars: 180, speed: 1.2 });
    if (reduceMotion) {
      element.textContent = frame(0);
      return;
    }

    const started = performance.now();
    const draw = () => {
      element.textContent = frame((performance.now() - started) / 1000);
    };
    draw();
    const timer = window.setInterval(draw, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <div aria-hidden="true" className="app-backdrop">
      <pre ref={ref} className="app-ascii" />
    </div>
  );
}
