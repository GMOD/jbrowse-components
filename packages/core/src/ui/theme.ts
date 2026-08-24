import { createTheme } from '@mui/material'

import { deepMerge } from '../util/deepMerge.ts'
import { palettePresets, resolvePalette } from './palette.ts'
import { DEFAULT_FONT_SIZE, DEFAULT_SPACING } from './styleTheme.ts'

import type { AlignmentFill, StringColors } from './palette.ts'
import type {
  PaletteColor,
  PaletteColorOptions,
  Theme,
  ThemeOptions,
} from '@mui/material/styles'

// [null, f1, f2, f3, f-3, f-2, f-1] — slot 0 unused so positive frames read as
// .at(1/2/3) and negative frames fall out of JS negative-index semantics
type FrameTuple<T> = [
  null,
  T | undefined,
  T | undefined,
  T | undefined,
  T | undefined,
  T | undefined,
  T | undefined,
]
type Frames = FrameTuple<PaletteColor>
type FramesOptions = FrameTuple<PaletteColorOptions>
// The plain '#rrggbb' string colors are `StringColors` from palette.ts, reused
// here rather than restated: they are required on Palette and optional on
// PaletteOptions, so a new string color is added in one place and reaches both.
// The docs table in the theming guide is generated from these two interfaces
// (website/scripts/api-docs/generatePaletteDocs.ts), so every member needs a
// JSDoc line saying what it colors — the generator fails on one that doesn't.
declare module '@mui/material/styles' {
  interface Palette extends StringColors {
    /** Accordion headers and some toolbar chrome */
    tertiary: PaletteColor
    /** Secondary floating-action-button background */
    quaternary: PaletteColor
    /** Selection highlights */
    highlight: PaletteColor
    /** Text-match highlight behind search hits */
    textHighlight: PaletteColor
    /** Per-base colors for sequence and SNP rendering */
    bases: {
      /** Adenine */
      A: PaletteColor
      /** Cytosine */
      C: PaletteColor
      /** Guanine */
      G: PaletteColor
      /** Thymine */
      T: PaletteColor
      /** N / ambiguous base */
      N: PaletteColor
    }
    /** Reading-frame coloring outside CDS, indexed 1..3 and -1..-3 */
    frames: Frames
    /** Reading-frame coloring within CDS, indexed 1..3 and -1..-3 */
    framesCDS: Frames
    /** Read fill by pair orientation, when coloring alignments by pair */
    alignmentFill: AlignmentFill
  }
  interface PaletteOptions extends Partial<StringColors> {
    tertiary?: PaletteColorOptions
    quaternary?: PaletteColorOptions
    highlight?: PaletteColorOptions
    textHighlight?: PaletteColorOptions
    bases?: {
      A?: PaletteColorOptions
      C?: PaletteColorOptions
      G?: PaletteColorOptions
      T?: PaletteColorOptions
      N?: PaletteColorOptions
    }
    framesCDS?: FramesOptions
    frames?: FramesOptions
    alignmentFill?: Partial<AlignmentFill>
  }
}

// The colors themselves live in `palette.ts`, which imports no toolkit. This
// module's job is to hand what `resolvePalette` produces to MUI, so JBrowse's
// Material UI chrome and JBrowse's renderers cannot disagree about a color.
// Nothing here decides one.
// Static domain colors and the theme presets are re-exported from palette.ts so
// existing `@jbrowse/core/ui` imports are unaffected. Import them from
// `@jbrowse/core/ui/palette` to get them without pulling in Material UI.
export {
  colorFwdStrand,
  colorInterchrom,
  colorLongInsert,
  colorLongreadInv,
  colorNeutralRead,
  colorPairLL,
  colorPairLR,
  colorPairLRDark,
  colorPairRL,
  colorPairRR,
  colorRevStrand,
  colorShortInsert,
  colorSplitReadInversion,
  colorSupplementary,
  colorUnmappedMate,
  colorUnmappedMateDark,
  methylated5hmC,
  methylated5mC,
  tagColorPalette,
  unmethylated5mC,
} from './palette.ts'
export type { JBrowsePalette } from './palette.ts'

/**
 * The structurally-serializable inputs that fully describe a session's active
 * theme. A created MUI `Theme` carries functions (e.g. `breakpoints.up`) and
 * cannot cross the RPC worker boundary; these args can, and
 * {@link createJBrowseThemeFromArgs} rebuilds the identical theme on the other
 * side. A worker that only needs colors should call `resolvePalette` with these
 * instead, which skips Material UI entirely.
 */
export interface SerializableThemeArgs {
  configTheme?: ThemeOptions
  themeName?: string
  extraThemes?: ThemeMap
}

// The display names and MUI component overrides layered on top of each palette
// preset. The colors come from palette.ts, so a preset's palette is stated once
// and this map is the Material UI half of it.
export const defaultThemes = {
  default: { palette: palettePresets.default, name: 'Default (from config)' },
  lightStock: { palette: palettePresets.lightStock, name: 'Light (stock)' },
  lightMinimal: {
    name: 'Light (minimal)',
    palette: palettePresets.lightMinimal,
  },
  darkMinimal: {
    name: 'Dark (minimal)',
    palette: palettePresets.darkMinimal,
  },
  darkStock: {
    name: 'Dark (stock)',
    palette: palettePresets.darkStock,
    components: {
      // enableColorOnDark keeps the AppBar tinted with primary.main in dark
      // mode (default MUI behavior is to flatten it to the paper color)
      MuiAppBar: { defaultProps: { enableColorOnDark: true } },
    },
  },
} satisfies ThemeMap

// The default primary (midnight) has poor contrast as a text/control color in
// dark mode, so fall back to a text-like color there. The extra selectors let
// callers also recolor checked/focused states.
// xref https://stackoverflow.com/a/72546130/2129219
function darkModeContrastOverride(
  extraSelectors: string[] = [],
  textColor: 'primary' | 'secondary' = 'secondary',
) {
  return {
    root: ({ theme }: { theme: Theme }) =>
      theme.palette.mode === 'dark'
        ? {
            color: theme.palette.text[textColor],
            ...Object.fromEntries(
              extraSelectors.map(selector => [
                selector,
                { color: theme.palette.text[textColor] },
              ]),
            ),
          }
        : undefined,
  }
}

// midnight primary is nearly invisible as an icon color on the dark header/
// toolbars, so swap color="primary" icons and icon buttons to a text color in
// dark mode. Targets the colorPrimary slot only, leaving default/secondary/
// error icons untouched.
const darkModePrimaryIconOverride = {
  colorPrimary: ({ theme }: { theme: Theme }) =>
    theme.palette.mode === 'dark'
      ? { color: theme.palette.text.primary }
      : undefined,
}

// the static half of a JBrowse theme: sizing plus the MUI component defaults
// and style overrides every theme shares. No palette — that is the caller's,
// merged over this by createJBrowseBaseTheme.
const baseThemeOptions: ThemeOptions = {
  typography: {
    fontSize: DEFAULT_FONT_SIZE,
  },
  spacing: DEFAULT_SPACING,
  components: {
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: 12,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        size: 'small',
      },
      // the default button, especially when not using variant=contained, uses
      // theme.palette.primary.main for text which is very bad with dark
      // mode+midnight primary
      styleOverrides: darkModeContrastOverride([], 'primary'),
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        slotProps: {
          transition: {
            timeout: 150,
            unmountOnExit: true,
          },
        },
      },
    },
    MuiFilledInput: {
      defaultProps: {
        margin: 'dense',
      },
    },
    MuiFormControl: {
      defaultProps: {
        margin: 'dense',
        size: 'small',
      },
    },
    MuiFormHelperText: {
      defaultProps: {
        margin: 'dense',
      },
    },

    MuiIconButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: darkModePrimaryIconOverride,
    },
    MuiSvgIcon: {
      styleOverrides: darkModePrimaryIconOverride,
    },
    MuiInputBase: {
      defaultProps: {
        margin: 'dense',
      },
    },
    MuiAutocomplete: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiInputLabel: {
      defaultProps: {
        margin: 'dense',
      },
    },
    MuiToolbar: {
      defaultProps: {
        variant: 'dense',
      },
    },
    MuiListItem: {
      defaultProps: {
        dense: true,
      },
    },
    MuiOutlinedInput: {
      defaultProps: {
        margin: 'dense',
      },
    },
    MuiFab: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        secondary: ({ theme: t }: { theme: Theme }) => ({
          backgroundColor: t.palette.quaternary.main,
        }),
      },
    },
    MuiTable: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiPopover: {
      defaultProps: {
        transitionDuration: 0,
      },
    },
    MuiMenu: {
      defaultProps: {
        transitionDuration: 0,
      },
    },
    MuiMenuItem: {
      defaultProps: {
        dense: true,
      },
    },

    MuiTextField: {
      defaultProps: {
        margin: 'dense',
        variant: 'standard',
      },
    },
    MuiLink: {
      styleOverrides: {
        // the default link color uses theme.palette.primary.main which is
        // very bad with dark mode+midnight primary. use forest-green
        // (tertiary) in light mode, but fall back to a text-like color in
        // dark mode where tertiary has poor contrast on the dark background
        root: ({ theme }) => ({
          color:
            theme.palette.mode === 'dark'
              ? theme.palette.text.secondary
              : theme.palette.tertiary.main,
        }),
      },
    },
    MuiCheckbox: {
      styleOverrides: darkModeContrastOverride(['&.Mui-checked']),
    },
    MuiRadio: {
      styleOverrides: darkModeContrastOverride(['&.Mui-checked']),
    },
    MuiFormLabel: {
      styleOverrides: darkModeContrastOverride(['&.Mui-focused']),
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: ({ theme: t }: { theme: Theme }) => ({
          backgroundColor: t.palette.tertiary.main,
        }),
        content: ({ theme: t }: { theme: Theme }) => ({
          color: t.palette.tertiary.contrastText,
        }),
      },
    },
    MuiToggleButtonGroup: {
      defaultProps: {
        size: 'small',
      },
    },
    // Speed up ripple animations for snappier feel (default is 550ms)
    // See https://mui.com/material-ui/api/button-base/
    // and https://github.com/mui/material-ui/blob/master/packages/mui-material/src/ButtonBase/TouchRipple.js
    //
    // The click ripple only: a *focus* ripple is a different animation on the
    // same two elements — childPulsate, which runs `infinite` — so a blanket
    // 50ms turns MUI's 2500ms breath into a 20Hz strobe that never stops. It
    // shows up on any focus-visible button, and Chrome hands one out unasked:
    // it re-evaluates :focus-visible on the already-focused element after any
    // keystroke, and the focus event that a browser-tab switch fires on the way
    // back is what makes MUI act on it. So these select the enter and leaving
    // keyframes by name and let the pulsate keep its own duration.
    //
    // Both selectors also outrank TouchRipple's own rules on specificity, which
    // is what `!important` was here for.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '& .MuiTouchRipple-ripple.MuiTouchRipple-rippleVisible:not(.MuiTouchRipple-ripplePulsate)':
            {
              animationDuration: '50ms',
            },
          '& .MuiTouchRipple-child.MuiTouchRipple-childLeaving': {
            animationDuration: '50ms',
          },
        },
      },
    },
  },
}

export function createJBrowseBaseTheme(theme: ThemeOptions = {}): ThemeOptions {
  return deepMerge(baseThemeOptions, theme)
}

// themes carry a display `name` (shown in the theme picker) on top of the
// standard MUI ThemeOptions
export type ThemeMap = Record<string, ThemeOptions & { name?: string }>

/**
 * Rebuild a JBrowse theme from {@link SerializableThemeArgs}, the inverse of
 * passing those args across RPC. Mirrors a session's `theme` getter so the main
 * thread and a worker resolve to the same colors.
 */
export function createJBrowseThemeFromArgs(args: SerializableThemeArgs = {}) {
  return createJBrowseTheme(
    args.configTheme,
    { ...defaultThemes, ...args.extraThemes },
    args.themeName,
  )
}

// Memoizes the built MUI theme across calls. Bounded in practice: the key space
// is (config theme x selected preset), a handful of entries.
const themeCache = new Map<string, Theme>()

function getThemeCacheKey(
  configTheme: ThemeOptions,
  selectedTheme: ThemeOptions | undefined,
  themeName: string,
): string {
  // key on the single selected theme definition, not the whole themes map,
  // so configurable extraThemes that reuse a name still bust the cache.
  // configTheme only participates on the 'default' path that reads it
  return JSON.stringify(
    {
      configTheme: themeName === 'default' ? configTheme : undefined,
      selectedTheme,
      themeName,
    },
    // a plugin-supplied theme can carry style-override callbacks, which
    // JSON.stringify drops, so two such themes would otherwise share a key
    (_key, value: unknown) =>
      typeof value === 'function' ? value.toString() : value,
  )
}

/**
 * Build the Material UI theme for a set of theme inputs.
 *
 * The colors are `resolvePalette`'s, spliced in already resolved, so this and
 * every renderer read the same values by construction rather than by keeping
 * two lists in step. What this adds on top is the Material UI half: the
 * component defaults and style overrides in `baseThemeOptions`, plus whatever
 * non-palette options the selected theme or the config theme declares.
 */
export function createJBrowseTheme(
  configTheme: ThemeOptions = {},
  themes: ThemeMap = defaultThemes,
  themeName = 'default',
) {
  const cacheKey = getThemeCacheKey(configTheme, themes[themeName], themeName)
  const cached = themeCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const selected = themes[themeName] ?? themes.default ?? defaultThemes.default
  // only the 'default' theme draws from configTheme: the named themes are fixed
  // presets and intentionally ignore config palette/spacing/components
  const merged =
    themeName === 'default' ? deepMerge(selected, configTheme) : selected

  const theme = createTheme(
    createJBrowseBaseTheme({
      ...merged,
      palette: resolvePalette({ configTheme, themeName, extraThemes: themes }),
    }),
  )

  themeCache.set(cacheKey, theme)
  return theme
}

// Alias for Theme; the `declare module` augmentation above adds the custom
// palette properties (frames, framesCDS, bases, etc.). Import this instead of
// Theme directly so those properties are typed.
export type JBrowseTheme = Theme
