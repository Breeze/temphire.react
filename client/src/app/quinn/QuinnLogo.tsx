/**
 * Quinn's logo: a "Q" ringed by five dots in five colours.
 *
 * Port of the Angular client's `quinn/quinn-logo.component.ts`.  The five dots are the five
 * ingredients of a punch - the drink that gave IdeaBlade's Punch framework its name, from the Hindi
 * "panch", five - and "Quinn" comes from the Latin "quinque", five.  Purely decorative.
 *
 * SVG works in JSX as in HTML, with the attribute names React uses: `strokeWidth` for
 * `stroke-width`, `className` for `class`.
 */
export function QuinnLogo({ className }: { className?: string }) {
  return (
    <span className={`quinn-logo ${className ?? ''}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        {/* The five ingredients, evenly around the Q, leaving room for its tail. */}
        <circle cx="18.5" cy="13.4" r="4" fill="#ffd166" />
        <circle cx="45.5" cy="13.4" r="4" fill="#ef476f" />
        <circle cx="54" cy="38.5" r="4" fill="#06d6a0" />
        <circle cx="32" cy="55" r="4" fill="#4cc9f0" />
        <circle cx="10" cy="38.5" r="4" fill="#f78c6b" />
        {/* The Q. */}
        <circle cx="32" cy="32" r="13" fill="none" stroke="currentColor" strokeWidth="6" />
        <path d="M38.5 38.5 L47 47" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
