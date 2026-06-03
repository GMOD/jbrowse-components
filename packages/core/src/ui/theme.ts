import { createTheme } from '@mui/material'
import { blue, brown, green, grey, orange, red } from '@mui/material/colors'
import deepmerge from 'deepmerge'

import type {
  PaletteColor,
  PaletteColorOptions,
  Theme,
  ThemeOptions,
} from '@mui/material/styles'

interface PaletteAugmentColorOptions {
  color: PaletteColorOptions
}

type MaybePaletteColor = PaletteColor | undefined
type Frames = [
  null,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
]
declare module '@mui/material/styles' {
  interface Palette {
    tertiary: PaletteColor
    quaternary: PaletteColor
    highlight: PaletteColor
    textHighlight: PaletteColor
    stopCodon: string
    startCodon: string
    coverage: string
    insertion: string
    softclip: string
    skip: string
    hardclip: string
    deletion: string
    modificationFwd: string
    modificationRev: string
    mutedSnpBase: string
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
  interface PaletteOptions {
    tertiary?: PaletteColorOptions
    quaternary?: PaletteColorOptions
    highlight?: PaletteColorOptions
    textHighlight?: PaletteColorOptions
    stopCodon?: string
    startCodon?: string
    coverage?: string
    hardclip?: string
    softclip?: string
    insertion?: string
    skip?: string
    deletion?: string
    modificationFwd?: string
    modificationRev?: string
    mutedSnpBase?: string
    bases?: {
      A?: PaletteColorOptions
      C?: PaletteColorOptions
      G?: PaletteColorOptions
      T?: PaletteColorOptions
      N?: PaletteColorOptions
    }
    framesCDS?: Frames
    frames?: Frames
    alignmentFill?: {
      pairLR?: string
      pairRL?: string
      pairLL?: string
      pairRR?: string
    }
  }
}

const refTheme = createTheme()

// augment a color (a '#rrggbb' main shade or a full MUI color object) into a
// PaletteColor with light/dark/contrastText variants
function augment(color: PaletteColorOptions) {
  return refTheme.palette.augmentColor({ color })
}
const hex = (main: string) => augment({ main })

const midnight = hex('#0D233F')
const grape = hex('#721E63')
const forest = hex('#135560')
const mandarin = hex('#FFB11D')
const textHighlight = hex('#ffe066')
const lightgrey = hex('#aaa')
const bases = {
  A: augment(green),
  C: augment(blue),
  G: augment(orange),
  T: augment(red),
  // N / ambiguous bases: muted brown — a distinct hue so it never blends into
  // the grey coverage histogram the way mutedSnpBase (reserved for the
  // show-modifications muting) does.
  N: augment(brown),
}
const framesCDS: Frames = [
  null,
  hex('#FF8080'),
  hex('#80FF80'),
  hex('#8080FF'),
  hex('#8080FF'),
  hex('#80FF80'),
  hex('#FF8080'),
]
const frames: Frames = [
  null,
  hex('#8f8f8f'),
  hex('#adadad'),
  hex('#d8d8d8'),
  hex('#d8d8d8'),
  hex('#adadad'),
  hex('#8f8f8f'),
]
const stopCodon = '#e22'
const startCodon = '#3e3'
const coverage = grey[400]
/** #color alignments-indicators | Insertion | Reads carry an insertion relative to the reference */
const insertion = '#800080'
const deletion = '#808080'
/** #color alignments-indicators | Soft clip | Reads are soft-clipped (clipped bases retained in the read) */
const softclip = '#00f'
/** #color alignments-indicators | Hard clip | Reads are hard-clipped (clipped bases removed from the read) */
const hardclip = '#f00'
const skip = '#009a8a'
const modificationFwd = '#c8c8c8'
const modificationRev = '#c8dcc8'
const mutedSnpBase = '#888'

// Alignment read fill colors — exported as plain constants (not palette entries)
// so they can be imported in RPC workers that have no MUI theme context.
export const colorFwdStrandNotProper = '#ECC8C8'
export const colorRevStrandNotProper = '#BEBED8'
/** #color alignments-strand | Forward strand | Read maps to the forward strand */
export const colorFwdStrand = '#EC8B8B'
/** #color alignments-strand | Reverse strand | Read maps to the reverse strand */
export const colorRevStrand = '#8F8FD8'
export const colorFwdMissingMate = '#D11919'
export const colorRevMissingMate = '#1919D1'
export const colorFwdDiffChr = '#000'
export const colorRevDiffChr = '#969696'
/** #color alignments-pair-orientation | LR (→ ←, normal proper pair) | Concordant */
export const colorPairLR = '#d3d3d3'
/** #color alignments-pair-orientation | RL (← →, mates point away from each other) | Abnormal orientation */
export const colorPairRL = '#0099bb'
/** #color alignments-pair-orientation | LL (→ →, both mates forward strand) | Abnormal orientation */
export const colorPairLL = '#4d9a4d'
/** #color alignments-pair-orientation | RR (← ←, both mates reverse strand) | Abnormal orientation */
export const colorPairRR = '#5555bb'
export const colorNostrand = '#c8c8c8'
export const colorInterchrom = '#aa00aa'
export const colorLongInsert = '#ff0000'
export const colorShortInsert = '#ffc0cb'
export const colorUnmappedMate = '#b05a20'
export const colorUnknown = '#808080'
export const colorLongreadRevFwd = '#6688ee'
export const colorLongreadInv = '#7755bb'
export const colorSupplementary = '#f0b878'

export const methylated5mC = '#ff0000'
export const unmethylated5mC = '#0000ff'
export const methylated5hmC = '#ffc0cb'
export const unmethylated5hmC = '#800080'

const alignmentFill = {
  pairLR: colorPairLR,
  pairRL: colorPairRL,
  pairLL: colorPairLL,
  pairRR: colorPairRR,
}

const defaults = {
  primary: midnight,
  secondary: grape,
  tertiary: forest,
  quaternary: mandarin,
  highlight: mandarin,
  textHighlight,
  stopCodon,
  startCodon,
  coverage,
  insertion,
  deletion,
  softclip,
  hardclip,
  modificationFwd,
  modificationRev,
  mutedSnpBase,
  bases,
  frames,
  framesCDS,
  skip,
  alignmentFill,
}

const stock = { palette: { ...defaults, mode: undefined } }

export const defaultThemes = {
  default: { ...stock, name: 'Default (from config)' },
  lightStock: { ...stock, name: 'Light (stock)' },
  lightMinimal: {
    name: 'Light (minimal)',
    palette: {
      ...defaults,
      primary: { main: grey[900] },
      secondary: { main: grey[800] },
      tertiary: { main: grey[900] },
    },
  },
  darkMinimal: {
    name: 'Dark (minimal)',
    palette: {
      ...defaults,
      mode: 'dark',
      coverage: grey[700],
      primary: { main: grey[700] },
      secondary: { main: grey[800] },
      tertiary: { main: grey[900] },
    },
  },
  darkStock: {
    name: 'Dark (stock)',
    palette: { ...defaults, mode: 'dark', coverage: grey[700] },
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
function darkModeContrastOverride(extraSelectors: string[] = []) {
  return {
    root: ({ theme }: { theme: Theme }) =>
      theme.palette.mode === 'dark'
        ? {
            color: theme.palette.text.secondary,
            ...Object.fromEntries(
              extraSelectors.map(selector => [
                selector,
                { color: theme.palette.text.secondary },
              ]),
            ),
          }
        : undefined,
  }
}

export function createJBrowseBaseTheme(theme?: ThemeOptions): ThemeOptions {
  const themeP: ThemeOptions = {
    palette: theme?.palette,
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
          size: 'small' as const,
        },
        styleOverrides: {
          // the default button, especially when not using variant=contained,
          // uses theme.palette.primary.main for text which is very bad with
          // dark mode+midnight primary
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.primary,
                }
              : undefined,
        },
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
          margin: 'dense' as const,
        },
      },
      MuiFormControl: {
        defaultProps: {
          margin: 'dense' as const,
          size: 'small' as const,
        },
      },
      MuiFormHelperText: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },

      MuiIconButton: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiInputBase: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiAutocomplete: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiInputLabel: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiToolbar: {
        defaultProps: {
          variant: 'dense' as const,
        },
      },
      MuiListItem: {
        defaultProps: {
          dense: true,
        },
      },
      MuiOutlinedInput: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiFab: {
        defaultProps: {
          size: 'small' as const,
        },
        styleOverrides: {
          secondary: ({ theme: t }: { theme: Theme }) => ({
            backgroundColor: t.palette.quaternary.main,
          }),
        },
      },
      MuiTable: {
        defaultProps: {
          size: 'small' as const,
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
          margin: 'dense' as const,
          variant: 'standard' as const,
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
          size: 'small' as const,
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
  return deepmerge(themeP, theme ?? {}, { arrayMerge: overwriteArrayMerge })
}

// themes carry a display `name` (shown in the theme picker) on top of the
// standard MUI ThemeOptions
export type ThemeMap = Record<string, ThemeOptions & { name?: string }>

const themeCache = new Map<string, Theme>()

function getThemeCacheKey(
  configTheme: ThemeOptions,
  selectedTheme: ThemeOptions | undefined,
  themeName: string,
): string {
  // key on the single selected theme definition, not the whole themes map,
  // so configurable extraThemes that reuse a name still bust the cache
  return JSON.stringify({ configTheme, selectedTheme, themeName })
}

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

  const theme = createTheme(
    createJBrowseBaseTheme(
      themeName === 'default'
        ? deepmerge(themes.default!, augmentThemeColors(configTheme), {
            arrayMerge: overwriteArrayMerge,
          })
        : addMissingColors(themes[themeName]),
    ),
  )

  themeCache.set(cacheKey, theme)
  return theme
}

// MUI by default allows strings like '#f00' for primary and secondary and
// augments them to have light and dark variants but not for anything else, so
// we augment them here
function augmentThemeColors(theme: ThemeOptions = {}) {
  const augmentedPalette: Record<string, PaletteColor> = Object.create(null)
  for (const entry of [
    'primary',
    'secondary',
    'tertiary',
    'quaternary',
    'highlight',
    'textHighlight',
  ] as const) {
    const paletteEntry = theme.palette?.[entry]
    if (paletteEntry) {
      augmentedPalette[entry] =
        'color' in paletteEntry
          ? refTheme.palette.augmentColor(
              paletteEntry as PaletteAugmentColorOptions,
            )
          : augment(paletteEntry)
    }
  }
  return Object.keys(augmentedPalette).length > 0
    ? deepmerge(theme, { palette: augmentedPalette })
    : theme
}

// adds missing colors to users theme
function addMissingColors(theme: ThemeOptions = {}) {
  const { palette } = theme
  return augmentThemeColors(
    deepmerge(
      theme,
      {
        palette: {
          quaternary: palette?.quaternary ?? lightgrey,
          tertiary: palette?.tertiary ?? lightgrey,
          highlight: palette?.highlight ?? mandarin,
          textHighlight: palette?.textHighlight ?? textHighlight,
          coverage: palette?.coverage ?? coverage,
          insertion: palette?.insertion ?? insertion,
          softclip: palette?.softclip ?? softclip,
          skip: palette?.skip ?? skip,
          hardclip: palette?.hardclip ?? hardclip,
          deletion: palette?.deletion ?? deletion,
          modificationFwd: palette?.modificationFwd ?? modificationFwd,
          modificationRev: palette?.modificationRev ?? modificationRev,
          mutedSnpBase: palette?.mutedSnpBase ?? mutedSnpBase,
          startCodon: palette?.startCodon ?? startCodon,
          stopCodon: palette?.stopCodon ?? stopCodon,
          bases: { ...bases, ...palette?.bases },
          frames: palette?.frames ?? frames,
          framesCDS: palette?.framesCDS ?? framesCDS,
          alignmentFill: { ...alignmentFill, ...palette?.alignmentFill },
        },
      },
      // overwrite (don't concatenate) the frames/framesCDS arrays, matching
      // the default-theme merge in createJBrowseTheme
      { arrayMerge: overwriteArrayMerge },
    ),
  )
}

// Alias for Theme; the `declare module` augmentation above adds the custom
// palette properties (frames, framesCDS, bases, etc.). Import this instead of
// Theme directly so those properties are typed.
export type JBrowseTheme = Theme
