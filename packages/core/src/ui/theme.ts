import { createTheme } from '@mui/material'
import { blue, brown, green, grey, orange, red } from '@mui/material/colors'
import deepmerge from 'deepmerge'

import type {
  PaletteColor,
  PaletteColorOptions,
  PaletteOptions,
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
    featureSelected: string
    featureDescription: string
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
    codonNonsynonymous?: string
    codonSynonymous?: string
    codonStop?: string
    coverage?: string
    hardclip?: string
    softclip?: string
    insertion?: string
    skip?: string
    deletion?: string
    modificationFwd?: string
    modificationRev?: string
    mutedSnpBase?: string
    missingData?: string
    gridlineMinor?: string
    gridlineMajor?: string
    featureHover?: string
    featureSelected?: string
    featureDescription?: string
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
/** #color theme-colors | Stop codon | Stop codon in gene/CDS tracks */
const stopCodon = '#e22'
/** #color theme-colors | Start codon | Start codon in gene/CDS tracks */
const startCodon = '#3e3'
/** #color maf | Nonsynonymous codon | MAF codon view: the species' amino acid differs from the reference (nonsynonymous) */
const codonNonsynonymous = '#e8930c'
/** #color maf | Synonymous codon | MAF codon view: the codon differs from the reference but the amino acid is unchanged (silent) */
const codonSynonymous = '#3a7bd5'
/** #color maf | Codon stop | MAF codon view: a stop codon */
const codonStop = '#cc2222'
const coverage = grey[400]
/** #color alignments-indicators | Insertion | Reads carry an insertion relative to the reference */
const insertion = '#800080'
/** #color theme-colors | Deletion | Deletion markers in alignments */
const deletion = '#808080'
/** #color alignments-indicators | Soft clip | Reads are soft-clipped (clipped bases retained in the read) */
const softclip = '#00f'
/** #color alignments-indicators | Hard clip | Reads are hard-clipped (clipped bases removed from the read) */
const hardclip = '#f00'
/** #color theme-colors | Skip (intron) | Skipped regions such as introns in RNA-seq reads */
const skip = '#009a8a'
/** #color theme-colors | Base modification (fwd) | Base modifications on the forward strand */
const modificationFwd = '#c8c8c8'
/** #color theme-colors | Base modification (rev) | Base modifications on the reverse strand */
const modificationRev = '#c8dcc8'
/** #color theme-colors | Muted SNP base | SNP bases muted when show-modifications coloring is on */
const mutedSnpBase = '#888'
// MAF bridged-row fill where the species has no alignment (à la UCSC)
const missingData = '#ffffcc'

// vertical gridlines behind the genome. white-on-dark reads far stronger than
// dark-on-white at the same alpha, so dark mode uses a gentler stroke
const gridlineMinor = 'rgba(0,0,0,0.12)'
const gridlineMajor = 'rgba(0,0,0,0.26)'
const gridlineMinorDark = 'rgba(255,255,255,0.06)'
const gridlineMajorDark = 'rgba(255,255,255,0.15)'

// Hover shading over a feature. Same asymmetry as gridlines: darkening works on
// a light track, but on a dark track it must lighten instead or it's invisible.
const featureHover = 'rgba(0,0,0,0.15)'
const featureHoverDark = 'rgba(255,255,255,0.25)'

// Border accent around the click-selected feature. The saturated blue reads on
// a light track; on a dark track it's lightened to keep the outline distinct.
const featureSelected = 'rgba(0,100,255,0.8)'
const featureSelectedDark = 'rgba(120,180,255,0.9)'

// Blue accent for feature description labels (e.g. gene descriptions). The
// plain CSS 'blue' reads as near-black against a dark track background, so
// dark mode uses a lighter blue instead.
const featureDescription = 'blue'
const featureDescriptionDark = blue[300]

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
// Dimmer grey for dark mode: the light #d3d3d3 reads as near-white glaring
// blocks against a dark track background. Wired into darkPalette.alignmentFill.
export const colorPairLRDark = '#8a8a8a'
/** #color alignments-pair-orientation | RL (← →, mates point away from each other) | Abnormal orientation */
export const colorPairRL = '#0099bb'
/** #color alignments-pair-orientation | LL (→ →, both mates forward strand) | Abnormal orientation */
export const colorPairLL = '#4d9a4d'
/** #color alignments-pair-orientation | RR (← ←, both mates reverse strand) | Abnormal orientation */
export const colorPairRR = '#5555bb'
export const colorNostrand = '#c8c8c8'
/**
 * #color alignments-pair-orientation | Inter-chromosomal | Mate maps to a different chromosome; colored distinctly rather than by orientation
 * #color alignments-insert-size | Mate on a different chromosome | Suggests an inter-chromosomal event
 */
export const colorInterchrom = '#6e4b3a'
/** #color alignments-insert-size | Insert larger than expected | Suggests a deletion spanning the pair */
export const colorLongInsert = '#ff0000'
/** #color alignments-insert-size | Insert smaller than expected | Suggests an insertion between the pair */
export const colorShortInsert = '#ffc0cb'
// Saturated short-insert variant for stroked marks (read-cloud / arc lines).
// The pale #ffc0cb fill reads fine on filled pileup rectangles but, drawn as a
// thin translucent line, blends into the white background and vanishes — so the
// stroke-only arc palette uses a saturated pink instead (mirrors origin/main's
// strokeColor.color_shortinsert vs its pale fill).
export const colorShortInsertArc = '#ff3a8c'
export const colorUnmappedMate = '#b05a20'
export const colorUnknown = '#808080'
export const colorLongreadRevFwd = '#6688ee'
export const colorLongreadInv = '#7755bb'
export const colorSupplementary = '#f0b878'

// Qualitative palette for coloring reads by an arbitrary tag value (e.g. the HP
// haplotype tag). Pale "tol_light" scheme:
// https://cran.r-project.org/web/packages/khroma/vignettes/tol.html
export const tagColorPalette = [
  '#BBCCEE',
  'pink',
  '#CCDDAA',
  '#EEEEBB',
  '#FFCCCC',
  'lightblue',
  'lightgreen',
  'tan',
  '#CCEEFF',
  'lightsalmon',
]

/** #color theme-methylation | methylated5mC | 5-methylcytosine, methylated */
export const methylated5mC = '#ff0000'
/** #color theme-methylation | unmethylated5mC | 5-methylcytosine, unmethylated */
export const unmethylated5mC = '#0000ff'
/** #color theme-methylation | methylated5hmC | 5-hydroxymethylcytosine, methylated */
export const methylated5hmC = '#ffc0cb'
/** #color theme-methylation | unmethylated5hmC | 5-hydroxymethylcytosine, unmethylated */
export const unmethylated5hmC = '#800080'

const alignmentFill = {
  pairLR: colorPairLR,
  pairRL: colorPairRL,
  pairLL: colorPairLL,
  pairRR: colorPairRR,
}

// plain-string domain colors. shared between `defaults` and `addMissingColors`
// so a new color only needs adding here (plus the Palette interfaces) — these
// can all be layered as a deepmerge base since a user theme's string value
// cleanly overrides rather than partially merging
const stringColorDefaults = {
  stopCodon,
  startCodon,
  codonNonsynonymous,
  codonSynonymous,
  codonStop,
  coverage,
  insertion,
  deletion,
  softclip,
  hardclip,
  skip,
  modificationFwd,
  modificationRev,
  mutedSnpBase,
  missingData,
  gridlineMinor,
  gridlineMajor,
  featureHover,
  featureSelected,
  featureDescription,
}

const defaults = {
  primary: midnight,
  secondary: grape,
  tertiary: forest,
  quaternary: mandarin,
  highlight: mandarin,
  textHighlight,
  ...stringColorDefaults,
  bases,
  frames,
  framesCDS,
  alignmentFill,
}

// string color defaults that differ in dark mode (gentler gridlines/hover,
// darker coverage). Layered under any dark theme — built-in or config-defined —
// by addMissingColors so a custom dark theme inherits the dark-tuned values.
const darkStringColorDefaults = {
  coverage: grey[700],
  gridlineMinor: gridlineMinorDark,
  gridlineMajor: gridlineMajorDark,
  featureHover: featureHoverDark,
  featureSelected: featureSelectedDark,
  featureDescription: featureDescriptionDark,
  // the deletion rect replaces the read on the dark track background, where the
  // mid-grey #808080 reads as a muddy block; lighten it so the gap stands out
  deletion: '#c8c8c8',
}

// spread the light alignmentFill so only pairLR changes (the light #d3d3d3 reads
// as glaring near-white blocks on a dark track)
const darkAlignmentFill = { ...alignmentFill, pairLR: colorPairLRDark }

// palette entries that differ in dark mode, shared by the dark themes
const darkPalette = {
  mode: 'dark' as const,
  ...darkStringColorDefaults,
  alignmentFill: darkAlignmentFill,
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
      ...darkPalette,
      primary: { main: grey[700] },
      secondary: { main: grey[800] },
      tertiary: { main: grey[900] },
    },
  },
  darkStock: {
    name: 'Dark (stock)',
    palette: {
      ...defaults,
      ...darkPalette,
    },
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
function darkModePrimaryIconOverride() {
  return {
    colorPrimary: ({ theme }: { theme: Theme }) =>
      theme.palette.mode === 'dark'
        ? { color: theme.palette.text.primary }
        : undefined,
  }
}

export function createJBrowseBaseTheme(theme?: ThemeOptions): ThemeOptions {
  const themeP: ThemeOptions = {
    // palette is merged in via the final deepmerge(themeP, theme) below
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
        styleOverrides: darkModePrimaryIconOverride(),
      },
      MuiSvgIcon: {
        styleOverrides: darkModePrimaryIconOverride(),
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

/**
 * The structurally-serializable inputs that fully describe a session's active
 * theme. A created MUI `Theme` carries functions (e.g. `breakpoints.up`) and
 * can't cross the RPC worker boundary; these args can, and
 * {@link createJBrowseThemeFromArgs} rebuilds the identical theme on the other
 * side. `extraThemes` covers config-defined custom themes; `defaultThemes` is
 * already available wherever this runs, so it is not shipped.
 */
export interface SerializableThemeArgs {
  configTheme?: ThemeOptions
  themeName?: string
  extraThemes?: ThemeMap
}

/**
 * Rebuild a JBrowse theme from {@link SerializableThemeArgs} — the inverse of
 * passing those args across RPC. Mirrors a session's `theme` getter so the main
 * thread and worker resolve to the same colors.
 */
export function createJBrowseThemeFromArgs(args: SerializableThemeArgs = {}) {
  return createJBrowseTheme(
    args.configTheme,
    { ...defaultThemes, ...args.extraThemes },
    args.themeName,
  )
}

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
      // only the 'default' theme draws from configTheme — the named themes are
      // fixed presets and intentionally ignore config palette/spacing/etc
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

// palette color entries that take a bare '#rrggbb' main and need augmenting into
// full light/dark/contrastText PaletteColors
const augmentableColorKeys = [
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'highlight',
  'textHighlight',
] as const

const baseKeys = ['A', 'C', 'G', 'T', 'N'] as const

// augment one entry, accepting either the `{ color }` wrapper MUI's augmentColor
// expects or a bare PaletteColorOptions
function augmentColorOption(option: PaletteColorOptions): PaletteColor {
  return 'color' in option
    ? refTheme.palette.augmentColor(option as PaletteAugmentColorOptions)
    : augment(option)
}

// MUI by default allows strings like '#f00' for primary and secondary and
// augments them to have light and dark variants but not for anything else, so
// we augment them here. `bases` is augmented per-key too, so a config theme that
// overrides only a base's `main` still gets a consistent contrastText rather
// than inheriting the default green/blue/etc. shades it replaced (or undefined).
function augmentThemeColors(theme: ThemeOptions = {}) {
  const overlay: PaletteOptions = {}
  for (const key of augmentableColorKeys) {
    const entry = theme.palette?.[key]
    if (entry) {
      overlay[key] = augmentColorOption(entry)
    }
  }
  const basesEntry = theme.palette?.bases
  if (basesEntry) {
    const bases: PaletteOptions['bases'] = {}
    for (const key of baseKeys) {
      const entry = basesEntry[key]
      if (entry) {
        bases[key] = augmentColorOption(entry)
      }
    }
    overlay.bases = bases
  }
  return Object.keys(overlay).length > 0
    ? deepmerge(theme, { palette: overlay })
    : theme
}

// fills in JBrowse-specific colors a user/config theme omits. string colors and
// arrays layer underneath via deepmerge (the theme cleanly overrides them);
// PaletteColor entries (tertiary/quaternary/highlight/textHighlight) and the
// per-key `bases`/`alignmentFill` maps are resolved wholesale, since a deep
// merge would splice the theme's `main` onto stale light/dark shades. primary/
// secondary are intentionally left to MUI.
function addMissingColors(theme: ThemeOptions = {}) {
  const { palette } = theme
  // a config-defined theme can opt into dark mode without spreading the built-in
  // darkPalette, so pick the dark-tuned defaults off its declared mode
  const isDark = palette?.mode === 'dark'
  const resolved = deepmerge(
    theme,
    {
      palette: {
        quaternary: palette?.quaternary ?? lightgrey,
        tertiary: palette?.tertiary ?? lightgrey,
        highlight: palette?.highlight ?? mandarin,
        textHighlight: palette?.textHighlight ?? textHighlight,
        bases: { ...bases, ...palette?.bases },
        alignmentFill: {
          ...(isDark ? darkAlignmentFill : alignmentFill),
          ...palette?.alignmentFill,
        },
      },
    },
    { arrayMerge: overwriteArrayMerge },
  )
  return augmentThemeColors(
    // overwrite (don't concatenate) the frames/framesCDS arrays, matching the
    // default-theme merge in createJBrowseTheme
    deepmerge(
      {
        palette: {
          ...stringColorDefaults,
          ...(isDark ? darkStringColorDefaults : {}),
          frames,
          framesCDS,
        },
      },
      resolved,
      { arrayMerge: overwriteArrayMerge },
    ),
  )
}

// Alias for Theme; the `declare module` augmentation above adds the custom
// palette properties (frames, framesCDS, bases, etc.). Import this instead of
// Theme directly so those properties are typed.
export type JBrowseTheme = Theme
