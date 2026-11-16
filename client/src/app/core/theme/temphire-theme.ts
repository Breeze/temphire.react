import { MantineColorsTuple, createTheme } from '@mantine/core';

/**
 * TempHire's blue, the ten shades Mantine expects for a colour, lightest first.  The same scale as
 * the Angular client's preset, built around `#1d5380` (shade 7), the blue the original WPF app used
 * for its headings, which Quinn's launcher and chat bubbles use too.
 */
const temphire: MantineColorsTuple = [
  '#eef5fb',
  '#d7e7f5',
  '#b0cfeb',
  '#80b0dc',
  '#4f8fca',
  '#2c72b3',
  '#225f99',
  '#1d5380',
  '#184265',
  '#13324c',
];

/**
 * Port of the Angular client's `core/theme/temphire-preset.ts`, which made TempHire's blue the
 * primary colour of Optimus UI's Aura preset.  Mantine's theme does the same: buttons, focus rings,
 * links, selected tabs and checked radios all follow `primaryColor`.  Slightly rounder corners suit
 * the card layout in `styles.css`.
 */
export const temphireTheme = createTheme({
  primaryColor: 'temphire',
  primaryShade: 7,
  colors: { temphire },
  defaultRadius: 'md',
  radius: { xs: '3px', sm: '5px', md: '8px', lg: '10px', xl: '14px' },
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSizes: { xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '18px' },
});
