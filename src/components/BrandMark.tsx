import React from 'react';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="28" height="28" rx="7" fill="#1D4ED8" />
        <path
          d="M9.5 7.5H15.5L19.5 11.5V19.5C19.5 20.0523 19.0523 20.5 18.5 20.5H9.5C8.94772 20.5 8.5 20.0523 8.5 19.5V8.5C8.5 7.94772 8.94772 7.5 9.5 7.5Z"
          stroke="white"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 7.5V11.5H19.5"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 15.25L13.25 17L16.75 13.5"
          stroke="#93C5FD"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        DocuPing
      </span>
    </span>
  );
}
