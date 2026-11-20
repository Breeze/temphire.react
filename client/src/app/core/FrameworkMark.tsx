import './FrameworkMark.css';

/**
 * The React logo on React's dark disc, worn at the bottom right of a TempHire orb (`.temphire-orb`),
 * so the logo says which version of TempHire is running: the Angular version's orb wears Angular's.
 *
 * Port of the Angular client's `core/framework-mark.component.ts`, with the other framework's logo.
 * Purely decorative, like the orb itself.
 */
export function FrameworkMark() {
  return (
    <span className="framework-mark">
      <svg viewBox="-11.5 -10.23174 23 20.46348" aria-hidden="true" focusable="false">
        <circle r="2.05" fill="#61dafb" />
        <g stroke="#61dafb" strokeWidth="1" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
    </span>
  );
}
