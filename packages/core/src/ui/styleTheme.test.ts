/**
 * Parity between `resolveStyleTheme` (plain data, no toolkit) and the MUI theme
 * `createJBrowseTheme` builds.
 *
 * The sibling of `palette.test.ts`, and load-bearing for the same reason: what
 * `makeStyles` hands a component used to *be* the MUI theme, so every one of
 * the 268 call sites has to keep resolving to the values it resolved to before,
 * and a `makeStyles` row next to a `<Typography>` has to keep agreeing with it.
 * If MUI changes its type scale or its spacing transform on an upgrade, it
 * fails here rather than as a slightly misaligned browser.
 */
import { createJBrowseTheme } from './theme.ts'
import {
  DEFAULT_FONT_FAMILY,
  createSpacing,
  createTypography,
  resolveStyleTheme,
} from './styleTheme.ts'

import type { JBrowseStyleTheme } from './styleTheme.ts'
import type { Theme, ThemeOptions } from '@mui/material/styles'

// the sizes a `pxToRem` caller actually passes, plus the boundaries: 0, a
// fraction, and one large enough to expose a rounding difference
const remSizes = [0, 1, 10.5, 11, 12, 14, 16, 20, 96]
const spacingArgs: number[][] = [[], [0], [0.25], [0.5], [1], [2], [4], [1, 0]]

function flatten(theme: JBrowseStyleTheme | Theme) {
  const { typography: t } = theme
  return {
    spacing: spacingArgs.map(args => theme.spacing(...args)),
    borderRadius: theme.shape.borderRadius,
    typography: {
      fontFamily: t.fontFamily,
      fontSize: t.fontSize,
      htmlFontSize: t.htmlFontSize,
      fontWeightLight: t.fontWeightLight,
      fontWeightRegular: t.fontWeightRegular,
      fontWeightMedium: t.fontWeightMedium,
      fontWeightBold: t.fontWeightBold,
      pxToRem: remSizes.map(size => t.pxToRem(size)),
      body1: { ...t.body1 },
      body2: { ...t.body2 },
    },
  }
}

function expectParity(configTheme?: ThemeOptions) {
  expect(flatten(resolveStyleTheme({ configTheme }))).toEqual(
    flatten(createJBrowseTheme(configTheme)),
  )
}

test('the default theme', () => {
  expectParity()
})

test('a config theme setting fontSize, which rescales every variant', () => {
  expectParity({ typography: { fontSize: 10 } })
})

test('a config theme setting spacing', () => {
  expectParity({ spacing: 2 })
})

test('a config theme setting both, which is what the theming guide shows', () => {
  expectParity({ typography: { fontSize: 10 }, spacing: 2 })
})

test('a config theme setting htmlFontSize', () => {
  expectParity({ typography: { htmlFontSize: 10 } })
})

test('a config theme setting the font weights', () => {
  expectParity({
    typography: { fontWeightRegular: 300, fontWeightMedium: 600 },
  })
})

/**
 * MUI drops `letterSpacing` from a variant whose family is not the stock one,
 * rather than resetting it to `normal` — the values were designed for Roboto's
 * kerning. Asserted on its own because it is the one place the two sides
 * produce a *different set of keys*, which a value-by-value diff would only
 * report as a confusing undefined.
 */
test('a custom font family drops the Roboto letter-spacing', () => {
  const configTheme = { typography: { fontFamily: 'Comic Sans MS' } }
  expectParity(configTheme)
  expect(
    resolveStyleTheme({ configTheme }).typography.body1.letterSpacing,
  ).toBeUndefined()
  expect(
    resolveStyleTheme({}).typography.body1.letterSpacing,
  ).toBe('0.00938em')
})

test('spacing as an array is a lookup table, not a multiplier', () => {
  const spacing = createSpacing([0, 3, 7])
  expect(spacing(0)).toBe('0px')
  expect(spacing(2)).toBe('7px')
  expect(spacing(1, 2)).toBe('3px 7px')
})

test('a string entry in the spacing table carries its own unit', () => {
  expect(createSpacing([0, '1rem'])(1)).toBe('1rem')
})

test('no spacing declared is the JBrowse grid unit, not Material’s 8', () => {
  expect(createSpacing(undefined)(1)).toBe('4px')
})

/**
 * A `theme.spacing` in a `makeStyles` block is a bare `theme.spacing()` in
 * seven of them. MUI reads that as one unit; a naive rest-args implementation
 * reads it as zero and emits the empty string, which is a silently collapsed
 * margin rather than an error.
 */
test('bare spacing() is one unit', () => {
  expect(createSpacing(4)()).toBe('4px')
})

test('the type scale keys match Material’s, spelled out', () => {
  expect(createTypography().body2).toEqual({
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 400,
    fontSize: '0.75rem',
    lineHeight: 1.43,
    letterSpacing: '0.01071em',
  })
})
