import { createTheme } from '@mui/material'
import deepmerge from 'deepmerge'

import { palettePresets, resolvePalette } from './palette.ts'

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
// plain '#rrggbb' string colors present (required) on Palette and (optional) on
// PaletteOptions — declared once here and reused on both via the interfaces
// below, so a new string color is added in a single place
interface JBrowseStringColors {
  stopCodon: string
  startCodon: string
  codonNonsynonymous: string
  codonSynonymous: string
  codonStop: string
  coverage: string
  insertion: string
  softclip: string
  skip: string
  hardclip: string
  deletion: string
  modificationFwd: string
  modificationRev: string
  mutedSnpBase: string
  missingData: string
  gridlineMinor: string
  gridlineMajor: string
  featureHover: string
  featureHoverStrong: string
  featureSelected: string
  featureDescription: string
}
declare module '@mui/material/styles' {
  interface Palette extends JBrowseStringColors {
    tertiary: PaletteColor
    quaternary: PaletteColor
    highlight: PaletteColor
    textHighlight: PaletteColor
    bases: {
      A: PaletteColor
      C: PaletteColor
      G: PaletteColor
      T: PaletteColor
      N: PaletteColor
    }
    frames: Frames
    framesCDS: Frames
    alignmentFill: {
      pairLR: string
      pairRL: string
      pairLL: string
      pairRR: string
    }
  }
  interface PaletteOptions extends Partial<JBrowseStringColors> {
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
    alignmentFill?: {
      pairLR?: string
      pairRL?: string
      pairLL?: string
      pairRR?: string
    }
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
  colorFwdDiffChr,
  colorFwdMissingMate,
  colorFwdStrand,
  colorFwdStrandNotProper,
  colorInterchrom,
  colorLongInsert,
  colorLongreadInv,
  colorLongreadRevFwd,
  colorNostrand,
  colorPairLL,
  colorPairLR,
  colorPairLRDark,
  colorPairRL,
  colorPairRR,
  colorRevDiffChr,
  colorRevMissingMate,
  colorRevStrand,
  colorRevStrandNotProper,
  colorShortInsert,
  colorShortInsertArc,
  colorSplitReadInversion,
  colorSupplementary,
  colorUnknown,
  colorUnmappedMate,
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

function overwriteArrayMerge(_: unknown, sourceArray: unknown[]) {
  return sourceArray
}

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
    fontSize: 12,
  },
  spacing: 4,
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
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '& .MuiTouchRipple-ripple': {
            animationDuration: '50ms !important',
          },
          '& .MuiTouchRipple-child': {
            animationDuration: '50ms !important',
          },
        },
      },
    },
  },
}

export function createJBrowseBaseTheme(theme: ThemeOptions = {}): ThemeOptions {
  return deepmerge(baseThemeOptions, theme, { arrayMerge: overwriteArrayMerge })
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
    themeName === 'default'
      ? deepmerge(selected, configTheme, { arrayMerge: overwriteArrayMerge })
      : selected

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
