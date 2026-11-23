interface LogoMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Five glass facets around a shared center. Flat SVG so the mark stays
 * legible at favicon size.
 */
export function LogoMark({ size = 44, className, title }: LogoMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      height={size}
      role={title ? "img" : undefined}
      viewBox="0 0 48 48"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      <g stroke="#ffffff" strokeLinejoin="round" strokeWidth="1.3">
        <polygon fill="#c5ced0" points="24,25 24,2 46,18" />
        <polygon fill="#94a1a4" points="24,25 46,18 37,45" />
        <polygon fill="#435053" points="24,25 37,45 11,45" />
        <polygon fill="#e3e7e8" points="24,25 11,45 2,18" />
        <polygon fill="#f4f6f6" points="24,25 2,18 24,2" />
      </g>

      <circle cx="24" cy="25" fill="#ffffff" fillOpacity="0.9" r="3.2" />
      <circle cx="24" cy="25" fill="none" r="5.7" stroke="#ffffff" strokeOpacity="0.5" />
    </svg>
  );
}
