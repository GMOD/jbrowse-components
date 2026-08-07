/**
 * JBrowse's non-color design tokens, as plain data.
 *
 * `palette.ts` did this for color; this is the rest of what a `makeStyles`
 * block reads — spacing, corner radius, the type scale — and it exists for the
 * same reason. `makeStyles` used to take Material UI's `Theme`, which meant one
 * six-line module (`util/tss-react/mui/mui.ts`) pulled `createTheme` into the
 * first paint of every host, including one rendering a display that draws
 * nothing Material at all. 268 call sites kept it there.
 *
 * The values below reproduce Material UI's, because they have to: JBrowse's own
 * chrome *is* Material UI, and a `makeStyles` row sitting next to a `Typography`
 * has to agree with it about what `body2` is. `styleTheme.test.ts` asserts that
 * member by member against a real MUI theme, so a drift on an upgrade shows up
 * as a test failure rather than as a slightly misaligned browser.
 *
 * `theme.ts` is the consumer, exactly as it is for the palette: it feeds these
 * constants into `createTheme` rather than restating them.
 */
import { resolvePalette } from './palette.ts'

import type { JBrowsePalette, ThemeInput } from './palette.ts'

/**
 * JBrowse's grid unit, in px. Half Material's 8, because a genome browser packs
 * far more controls into a toolbar than a Material layout expects.
 */
export const DEFAULT_SPACING = 4

/** Base font size, in px. Material's default is 14; JBrowse's chrome is denser. */
export const DEFAULT_FONT_SIZE = 12

/** What `pxToRem` assumes the `<html>` font size is. */
export const HTML_FONT_SIZE = 16

export const DEFAULT_FONT_FAMILY = '"Roboto", "Helvetica", "Arial", sans-serif'

export const DEFAULT_BORDER_RADIUS = 4

/**
 * One entry of the type scale. `letterSpacing` is absent for a non-Roboto
 * family rather than reset to `normal`, which is what MUI does and what lets a
 * host's own tracking through.
 */
export interface TypeVariant {
  fontFamily: string
  fontWeight: number | string
  fontSize: string
  lineHeight: number
  letterSpacing?: string
}

export interface JBrowseTypography {
  fontFamily: string
  fontSize: number
  htmlFontSize: number
  fontWeightLight: number | string
  fontWeightRegular: number | string
  fontWeightMedium: number | string
  fontWeightBold: number | string
  pxToRem: (size: number) => string
  body1: TypeVariant
  body2: TypeVariant
}

/**
 * What a `makeStyles` block is handed.
 *
 * Deliberately a subset of Material UI's `Theme` rather than a copy of it: it
 * carries what the 268 call sites read and nothing else, so anything reaching
 * further is a compile error naming the file rather than a silent dependency on
 * a component library. `transitions`, `zIndex` and `shadows` are the three that
 * used to be reached for; a literal reads better at each of those five sites,
 * and `ui/zIndexes.ts` already owns the layering that matters.
 */
export interface JBrowseStyleTheme {
  palette: JBrowsePalette
  spacing: (...args: number[]) => string
  shape: { borderRadius: number }
  typography: JBrowseTypography
}

export interface TypographyInput {
  fontFamily?: string
  fontSize?: number
  htmlFontSize?: number
  fontWeightLight?: number | string
  fontWeightRegular?: number | string
  fontWeightMedium?: number | string
  fontWeightBold?: number | string
}

/**
 * The non-color half of what a theme may declare — `spacing` and `typography`,
 * the two documented in the theming guide's "Sizing".
 *
 * Both admit a function arm, and that is not overbuilding: the config `theme`
 * slot is typed as MUI's `ThemeOptions`, which has one, so this has to accept
 * it for a caller to hand `themeOptions` straight in. Neither survives JSON, so
 * neither reaches here from a config; `resolveStyleTheme` falls back to the
 * defaults if one somehow does, rather than calling it.
 */
export interface SizingInput {
  spacing?:
    | number
    | string
    | readonly (number | string)[]
    | ((abs: never) => unknown)
  typography?: TypographyInput | ((palette: never) => unknown)
}

// MUI rounds letter-spacing to 5 decimal places; matched so the emitted `em`
// value is character-identical to the one on a neighbouring Typography.
function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

/**
 * A number is a grid unit and an array is a lookup table indexed by the
 * argument, which is Material's contract and what a JSON config slot can
 * express. An array entry that is already a string carries its own unit.
 */
export function createSpacing(input: SizingInput['spacing']) {
  const step =
    Array.isArray(input) || typeof input === 'number' ? input : DEFAULT_SPACING
  const transform = (n: number) => {
    const value = typeof step === 'number' ? n * step : step[n]
    return typeof value === 'number' ? `${value}px` : (value ?? '')
  }
  return (...args: number[]) =>
    (args.length === 0 ? [1] : args).map(transform).join(' ')
}

export function createTypography(input: TypographyInput = {}) {
  const {
    fontFamily = DEFAULT_FONT_FAMILY,
    fontSize = DEFAULT_FONT_SIZE,
    htmlFontSize = HTML_FONT_SIZE,
    fontWeightLight = 300,
    fontWeightRegular = 400,
    fontWeightMedium = 500,
    fontWeightBold = 700,
  } = input
  // Material's type scale is stated at fontSize 14 and scaled from there, so a
  // theme that sets fontSize moves every variant with it.
  const coef = fontSize / 14
  const pxToRem = (size: number) => `${(size / htmlFontSize) * coef}rem`
  // letterSpacing is only applied for the stock font: the values were designed
  // for Roboto and carrying them onto another family throws off its kerning,
  // which is MUI's rule and has to be this module's too.
  const variant = (
    fontWeight: number | string,
    size: number,
    lineHeight: number,
    letterSpacing: number,
  ): TypeVariant => ({
    fontFamily,
    fontWeight,
    fontSize: pxToRem(size),
    lineHeight,
    ...(fontFamily === DEFAULT_FONT_FAMILY
      ? { letterSpacing: `${round(letterSpacing / size)}em` }
      : {}),
  })
  return {
    fontFamily,
    fontSize,
    htmlFontSize,
    fontWeightLight,
    fontWeightRegular,
    fontWeightMedium,
    fontWeightBold,
    pxToRem,
    body1: variant(fontWeightRegular, 16, 1.5, 0.15),
    body2: variant(fontWeightRegular, 14, 1.43, 0.15),
  }
}

/** A theme, as far as the style theme is concerned: colors plus sizing. */
export interface StyleThemeInput extends ThemeInput, SizingInput {}

/** What `resolveStyleTheme` reads — `resolvePalette`'s arguments, plus sizing. */
export interface StyleThemeArgs {
  configTheme?: StyleThemeInput
  themeName?: string
  extraThemes?: Record<string, StyleThemeInput>
}

/**
 * Build the style theme for a set of theme args.
 *
 * The colors come from `resolvePalette`, so this and the MUI theme cannot
 * disagree about them by construction. Sizing follows the same rule the palette
 * does: only the `default` theme draws from the config, since the named presets
 * are fixed.
 */
export function resolveStyleTheme(
  args: StyleThemeArgs = {},
): JBrowseStyleTheme {
  const { configTheme, themeName = 'default', extraThemes } = args
  // only `extraThemes` is consulted for a preset: the built-in presets differ
  // from each other in color and in Material component overrides, never in
  // sizing, so there is nothing of theirs to read here
  const preset: SizingInput = extraThemes?.[themeName] ?? {}
  const sizing: SizingInput =
    themeName === 'default' ? { ...preset, ...configTheme } : preset
  const { typography } = sizing
  return {
    palette: resolvePalette(args),
    spacing: createSpacing(sizing.spacing),
    shape: { borderRadius: DEFAULT_BORDER_RADIUS },
    typography: createTypography(
      typeof typography === 'function' ? {} : typography,
    ),
  }
}

/**
 * The style theme a component gets with no provider above it, resolved once
 * rather than per call — a fresh object each render would defeat the
 * memoization every `makeStyles` hook depends on.
 */
export const defaultStyleTheme = resolveStyleTheme()
