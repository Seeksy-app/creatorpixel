// CreatorPixel mark: four pixels, one identified.
// Muted pixels inherit currentColor so the mark adapts to light/dark surfaces.
export default function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="13" height="13" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="17" y="2" width="13" height="13" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="2" y="17" width="13" height="13" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="17" y="17" width="13" height="13" rx="4" fill="#3361FF" />
      <circle cx="23.5" cy="23.5" r="2.6" fill="#fff" />
    </svg>
  );
}
