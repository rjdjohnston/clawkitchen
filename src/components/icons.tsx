"use client";

function IconSvg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SunIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 2v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 19.5V22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 12h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.5 12H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 4.2 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 18l1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 19.8 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconSvg>
  );
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        d="M21 14.2A7.8 7.8 0 0 1 9.8 3a7 7 0 1 0 11.2 11.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
