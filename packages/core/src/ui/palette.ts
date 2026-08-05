/**
 * JBrowse's colors, as plain data.
 *
 * This module is the single place a color is decided. It imports no UI toolkit,
 * so it loads in an RPC worker, in a GPU renderer, and in an embedding app that
 * has never heard of Material UI. `theme.ts` is a *consumer*: it takes what
 * `resolvePalette` produces and splices it into an MUI theme, so JBrowse's own
 * Material UI chrome and JBrowse's renderers cannot disagree about what
 * `highlight` means.
 *
 * The color math below reproduces MUI's `augmentColor` exactly, because the
 * config `theme` slot is public API shaped as MUI `ThemeOptions` and a user who
 * writes `primary: { main: '#0D233F' }` has to keep getting the same light,
 * dark and contrastText shades they got before. `palette.test.ts` asserts that
 * value by value against a real MUI theme, so a drift shows up as a test
 * failure rather than as a slightly different browser.
 *
 * The neutral tokens (text, background, divider, action) are JBrowse's own,
 * declared here rather than read off MUI. They start at the values MUI happens
 * to use, which is why the parity test passes, but they are ours: a renderer
 * asking for "the color text is drawn in" should not have to reach into a
 * component library to find out.
 */
import { colord } from '../util/colord.ts'

/** A resolved color and the three shades MUI-shaped consumers expect. */
export interface ColorQuad {
  main: string
  light: string
  dark: string
  contrastText: string
}

/**
 * What a theme may supply for an augmentable color: a bare CSS string, a
 * `{ main }` object, or a full MUI-style shade map (`{ 300, 500, 700 }`).
 */
export type ColorInput = string | ShadeInput

export interface ShadeInput {
  main?: string
  light?: string
  dark?: string
  contrastText?: string
  300?: string
  500?: string
  700?: string
}

/**
 * `[null, f1, f2, f3, f-3, f-2, f-1]`. Slot 0 is unused so positive frames read
 * as `.at(1/2/3)` and negative frames fall out of JS negative-index semantics.
 */
export type FrameTuple<T> = [
  null,
  T | undefined,
  T | undefined,
  T | undefined,
  T | undefined,
  T | undefined,
  T | undefined,
]

export type BaseKey = 'A' | 'C' | 'G' | 'T' | 'N'

export interface AlignmentFill {
  /** LR (→ ←): a normal, concordant proper pair */
  pairLR: string
  /** RL (← →): mates point away from each other */
  pairRL: string
  /** LL (→ →): both mates on the forward strand */
  pairLL: string
  /** RR (← ←): both mates on the reverse strand */
  pairRR: string
}

// ---------------------------------------------------------------------------
// MUI-compatible color math
//
// Reimplemented rather than imported so this module stays toolkit-free. The
// constants and the truncation behavior are MUI's, deliberately: see the module
// comment and the parity test.
// ---------------------------------------------------------------------------

const TONAL_OFFSET = 0.2
const CONTRAST_THRESHOLD = 3
// MUI picks contrast text between the two defaults below, not between the
// active mode's text colors, so this stays mode-independent
const CONTRAST_DARK_TEXT = '#fff'
const CONTRAST_LIGHT_TEXT = 'rgba(0, 0, 0, 0.87)'

/**
 * MUI recomposes a channel with `parseInt`, which truncates toward zero rather
 * than rounding. Matching that is the difference between `rgb(61, 79, 101)` and
 * `rgb(61, 79, 102)` for the default primary, so it is not a detail.
 */
function recompose(r: number, g: number, b: number, a: number) {
  const [rr, gg, bb] = [r, g, b].map(Math.trunc)
  return a < 1 ? `rgba(${rr}, ${gg}, ${bb}, ${a})` : `rgb(${rr}, ${gg}, ${bb})`
}

function shiftChannels(color: string, fn: (channel: number) => number) {
  const { r, g, b, a } = colord(color).toRgb()
  return recompose(fn(r), fn(g), fn(b), a)
}

export function lighten(color: string, coefficient: number) {
  return shiftChannels(color, v => v + (255 - v) * coefficient)
}

export function darken(color: string, coefficient: number) {
  return shiftChannels(color, v => v * (1 - coefficient))
}

/** Restate a color at a given opacity, as `rgba(r, g, b, a)`. */
export function alpha(color: string, value: number) {
  const { r, g, b } = colord(color).toRgb()
  const a = Math.min(Math.max(value, 0), 1)
  return `rgba(${Math.trunc(r)}, ${Math.trunc(g)}, ${Math.trunc(b)}, ${a})`
}

/** WCAG relative luminance, truncated to three digits the way MUI does. */
export function getLuminance(color: string) {
  const { r, g, b } = colord(color).toRgb()
  const [rr, gg, bb] = [r, g, b].map(channel => {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return Number((0.2126 * rr! + 0.7152 * gg! + 0.0722 * bb!).toFixed(3))
}

export function getContrastRatio(foreground: string, background: string) {
  const a = getLuminance(foreground)
  const b = getLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function getContrastText(background: string) {
  return getContrastRatio(background, CONTRAST_DARK_TEXT) >= CONTRAST_THRESHOLD
    ? CONTRAST_DARK_TEXT
    : CONTRAST_LIGHT_TEXT
}

/**
 * Expand a color into its four shades. A shade map supplies `light`/`dark`
 * directly from its 300/700 entries, anything else derives them by tonal
 * offset, and `contrastText` is chosen by contrast ratio against `main`.
 */
export function augmentColor(input: ColorInput): ColorQuad {
  const entry: ShadeInput = typeof input === 'string' ? { main: input } : input
  const main = entry.main ?? entry[500]
  if (!main) {
    throw new Error(
      'palette color needs a `main` or a `500` shade, got ' +
        JSON.stringify(input),
    )
  }
  return {
    main,
    light: entry.light ?? entry[300] ?? lighten(main, TONAL_OFFSET),
    dark: entry.dark ?? entry[700] ?? darken(main, TONAL_OFFSET * 1.5),
    contrastText: entry.contrastText ?? getContrastText(main),
  }
}

// ---------------------------------------------------------------------------
// Palette shade maps
//
// The handful of MUI shade values JBrowse's defaults are built from, inlined so
// this module owns them. They are the standard Material palette stops.
// ---------------------------------------------------------------------------

const green = { 300: '#81c784', 500: '#4caf50', 700: '#388e3c' }
const blue = { 300: '#64b5f6', 500: '#2196f3', 700: '#1976d2' }
const orange = { 300: '#ffb74d', 500: '#ff9800', 700: '#f57c00' }
const red = { 300: '#e57373', 500: '#f44336', 700: '#d32f2f' }
const brown = { 300: '#a1887f', 500: '#795548', 700: '#5d4037' }
export const grey = {
  400: '#bdbdbd',
  700: '#616161',
  800: '#424242',
  900: '#212121',
}

// ---------------------------------------------------------------------------
// Neutral tokens
//
// The subset of the standard neutral palette JBrowse's renderers actually read.
// A config theme overrides these the same way it overrides anything else.
// ---------------------------------------------------------------------------

export interface NeutralTokens {
  text: { primary: string; secondary: string; disabled: string }
  background: { paper: string; default: string }
  divider: string
  common: { black: string; white: string }
  action: {
    active: string
    hover: string
    selected: string
    disabled: string
    disabledBackground: string
  }
}

// A theme that declares no primary/secondary at all (a config `extraThemes`
// entry, in practice) falls back to the stock Material defaults rather than to
// JBrowse's brand colors, which is what it did when MUI owned this resolution.
const lightBrandFallback = {
  primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
  secondary: { main: '#9c27b0', light: '#ba68c8', dark: '#7b1fa2' },
}
const darkBrandFallback = {
  primary: { main: '#90caf9', light: '#e3f2fd', dark: '#42a5f5' },
  secondary: { main: '#ce93d8', light: '#f3e5f5', dark: '#ab47bc' },
}

const lightNeutrals: NeutralTokens = {
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  background: { paper: '#fff', default: '#fff' },
  divider: 'rgba(0, 0, 0, 0.12)',
  common: { black: '#000', white: '#fff' },
  action: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
  },
}

const darkNeutrals: NeutralTokens = {
  text: {
    primary: '#fff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    disabled: 'rgba(255, 255, 255, 0.5)',
  },
  background: { paper: '#121212', default: '#121212' },
  divider: 'rgba(255, 255, 255, 0.12)',
  common: { black: '#000', white: '#fff' },
  action: {
    active: '#fff',
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(255, 255, 255, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
  },
}

// ---------------------------------------------------------------------------
// Static domain colors
//
// Colors that do not vary with the theme. Already plain strings, already
// imported directly by worker code, kept here so every color in the system has
// one home. `theme.ts` re-exports them, so existing imports are unaffected.
// ---------------------------------------------------------------------------

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
// blocks against a dark track background. Wired into the dark alignmentFill.
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
// thin translucent line, blends into the white background and vanishes, so the
// stroke-only arc palette uses a saturated pink instead.
export const colorShortInsertArc = '#ff3a8c'
export const colorUnmappedMate = '#b05a20'
export const colorUnknown = '#808080'
export const colorLongreadRevFwd = '#6688ee'
export const colorLongreadInv = '#7755bb'
/** #color alignments-pair-orientation | Split-read inversion | A paired read's supplementary segment maps opposite-strand to its primary; the split crosses an inversion junction */
export const colorSplitReadInversion = '#9b30b0'
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

// ---------------------------------------------------------------------------
// Theme-varying colors
// ---------------------------------------------------------------------------

/** Plain string colors that a theme may override wholesale. */
export interface StringColors {
  /** Stop codon in gene/CDS tracks */
  stopCodon: string
  /** Start codon in gene/CDS tracks */
  startCodon: string
  /** MAF codon view: the species' amino acid differs from the reference */
  codonNonsynonymous: string
  /** MAF codon view: the codon differs but the amino acid does not */
  codonSynonymous: string
  /** MAF codon view: a stop codon */
  codonStop: string
  /** Coverage histogram fill */
  coverage: string
  /** Insertion markers in alignments */
  insertion: string
  /** Soft-clipped bases (clipped bases retained in the read) */
  softclip: string
  /** Skipped regions, such as introns in RNA-seq reads */
  skip: string
  /** Hard-clipped bases (clipped bases removed from the read) */
  hardclip: string
  /** Deletion markers in alignments */
  deletion: string
  /** Base modifications on the forward strand */
  modificationFwd: string
  /** Base modifications on the reverse strand */
  modificationRev: string
  /** SNP bases muted when show-modifications coloring is on */
  mutedSnpBase: string
  /** MAF bridged-row fill where a species has no alignment */
  missingData: string
  /** Minor vertical gridlines behind the genome */
  gridlineMinor: string
  /** Major vertical gridlines behind the genome */
  gridlineMajor: string
  /** Hover shading over a single feature */
  featureHover: string
  /** Hover shading over a feature group, e.g. a linked-read chain */
  featureHoverStrong: string
  /** Border accent around the click-selected feature */
  featureSelected: string
  /** Feature description labels, e.g. gene descriptions */
  featureDescription: string
}

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

const lightStringColors: StringColors = {
  stopCodon,
  startCodon,
  codonNonsynonymous,
  codonSynonymous,
  codonStop,
  coverage: grey[400],
  insertion,
  deletion,
  softclip,
  hardclip,
  skip,
  modificationFwd,
  modificationRev,
  mutedSnpBase,
  missingData,
  // vertical gridlines behind the genome
  gridlineMinor: 'rgba(0,0,0,0.12)',
  gridlineMajor: 'rgba(0,0,0,0.26)',
  // hover shading over a feature
  featureHover: 'rgba(0,0,0,0.15)',
  // stronger shade for a hovered group (e.g. a linked-read chain), so the group
  // reads more prominently than a single-feature hover
  featureHoverStrong: 'rgba(0,0,0,0.4)',
  // border accent around the click-selected feature
  featureSelected: 'rgba(0,100,255,0.8)',
  // blue accent for feature description labels (e.g. gene descriptions)
  featureDescription: 'blue',
}

// Dark overrides. White-on-dark reads far stronger than dark-on-white at the
// same alpha, so the gridlines and hover shades are gentler and inverted rather
// than reused, and the colors that would otherwise vanish are lightened.
const darkStringColors: Partial<StringColors> = {
  coverage: grey[700],
  gridlineMinor: 'rgba(255,255,255,0.06)',
  gridlineMajor: 'rgba(255,255,255,0.15)',
  featureHover: 'rgba(255,255,255,0.25)',
  featureHoverStrong: 'rgba(255,255,255,0.4)',
  featureSelected: 'rgba(120,180,255,0.9)',
  // plain CSS 'blue' reads as near-black against a dark track
  featureDescription: blue[300],
  // the deletion rect replaces the read on the dark track background, where the
  // mid-grey #808080 reads as a muddy block, so lighten it
  deletion: '#c8c8c8',
}

const lightAlignmentFill: AlignmentFill = {
  pairLR: colorPairLR,
  pairRL: colorPairRL,
  pairLL: colorPairLL,
  pairRR: colorPairRR,
}

// only pairLR changes: the light #d3d3d3 reads as glaring near-white blocks
const darkAlignmentFill: AlignmentFill = {
  ...lightAlignmentFill,
  pairLR: colorPairLRDark,
}

// ---------------------------------------------------------------------------
// Brand colors
// ---------------------------------------------------------------------------

const midnight = '#0D233F'
const grape = '#721E63'
const forest = '#135560'
const mandarin = '#FFB11D'
const textHighlightYellow = '#ffe066'
const lightgrey = '#aaa'

const defaultBases: Record<BaseKey, ShadeInput> = {
  A: green,
  C: blue,
  G: orange,
  T: red,
  // N / ambiguous bases: muted brown, a distinct hue so it never blends into
  // the grey coverage histogram the way mutedSnpBase does
  N: brown,
}

const defaultFramesCDS: FrameTuple<ShadeInput> = [
  null,
  { main: '#FF8080' },
  { main: '#80FF80' },
  { main: '#8080FF' },
  { main: '#8080FF' },
  { main: '#80FF80' },
  { main: '#FF8080' },
]

const defaultFrames: FrameTuple<ShadeInput> = [
  null,
  { main: '#8f8f8f' },
  { main: '#adadad' },
  { main: '#d8d8d8' },
  { main: '#d8d8d8' },
  { main: '#adadad' },
  { main: '#8f8f8f' },
]

// ---------------------------------------------------------------------------
// The palette itself
// ---------------------------------------------------------------------------

/**
 * Every color JBrowse renders, resolved. Plain strings throughout, so this
 * crosses the RPC worker boundary as itself rather than as arguments something
 * on the far side has to rebuild.
 */
export interface JBrowsePalette extends StringColors, NeutralTokens {
  mode: 'light' | 'dark'
  primary: ColorQuad
  secondary: ColorQuad
  tertiary: ColorQuad
  quaternary: ColorQuad
  highlight: ColorQuad
  textHighlight: ColorQuad
  bases: Record<BaseKey, ColorQuad>
  frames: FrameTuple<ColorQuad>
  framesCDS: FrameTuple<ColorQuad>
  alignmentFill: AlignmentFill
}

/**
 * The palette half of what a theme may declare. Structurally compatible with
 * MUI's `PaletteOptions`, which is what the config `theme` slot carries, so a
 * config theme is assignable here without a cast.
 */
export interface PaletteInput extends Partial<StringColors> {
  mode?: 'light' | 'dark'
  primary?: ShadeInput
  secondary?: ShadeInput
  tertiary?: ShadeInput
  quaternary?: ShadeInput
  highlight?: ShadeInput
  textHighlight?: ShadeInput
  bases?: Partial<Record<BaseKey, ShadeInput>>
  frames?: FrameTuple<ShadeInput>
  framesCDS?: FrameTuple<ShadeInput>
  alignmentFill?: Partial<AlignmentFill>
  text?: Partial<NeutralTokens['text']>
  background?: Partial<NeutralTokens['background']>
  divider?: string
  common?: Partial<NeutralTokens['common']>
  action?: Partial<NeutralTokens['action']>
}

/** A theme, as far as the palette is concerned. */
export interface ThemeInput {
  palette?: PaletteInput
}

/**
 * The palette half of the built-in themes. `theme.ts` composes these with the
 * display names and MUI component overrides that make up `defaultThemes`, so
 * the preset colors are stated once.
 */
// The JBrowse-branded colors every built-in preset starts from. Deliberately
// does NOT carry the string colors or alignmentFill: those have light and dark
// variants that `resolvePalette` picks off `mode`, and baking the light ones in
// here would shadow the dark set for any theme built on top.
const brandDefaults: PaletteInput = {
  primary: { main: midnight },
  secondary: { main: grape },
  tertiary: { main: forest },
  quaternary: { main: mandarin },
  highlight: { main: mandarin },
  textHighlight: { main: textHighlightYellow },
  bases: defaultBases,
  frames: defaultFrames,
  framesCDS: defaultFramesCDS,
}

export const palettePresets = {
  default: { ...brandDefaults },
  lightStock: { ...brandDefaults },
  lightMinimal: {
    ...brandDefaults,
    primary: { main: grey[900] },
    secondary: { main: grey[800] },
    tertiary: { main: grey[900] },
  },
  // the dark presets change only `mode` on top of the brand colors, and the
  // dark-tuned gridlines, hover, coverage and alignmentFill follow from it
  darkMinimal: {
    ...brandDefaults,
    mode: 'dark',
    primary: { main: grey[700] },
    secondary: { main: grey[800] },
    tertiary: { main: grey[900] },
  },
  darkStock: {
    ...brandDefaults,
    mode: 'dark',
  },
} satisfies Record<string, PaletteInput>

/**
 * What `resolvePalette` reads. Structurally the minimum of the public
 * `SerializableThemeArgs` (declared in `theme.ts`, where the MUI `ThemeOptions`
 * type is available), so a caller passes the public type straight in and this
 * module still imports no toolkit.
 */
export interface PaletteArgs {
  configTheme?: ThemeInput
  themeName?: string
  extraThemes?: Record<string, ThemeInput>
}

/**
 * Resolve a frame tuple. A theme's tuple replaces the default wholesale rather
 * than splicing entry by entry onto stale shades, so slots it leaves out are
 * filled from the default here. Consumers index by frame number and assume
 * every slot resolves.
 */
function resolveFrames(
  entry: FrameTuple<ShadeInput> | undefined,
  fallback: FrameTuple<ShadeInput>,
): FrameTuple<ColorQuad> {
  const source = entry ?? fallback
  return [
    null,
    ...([1, 2, 3, 4, 5, 6] as const).map(i => {
      const value = source[i] ?? fallback[i]
      return value === undefined ? undefined : augmentColor(value)
    }),
  ] as FrameTuple<ColorQuad>
}

/**
 * Build the palette for a set of theme arguments.
 *
 * Only the `default` theme draws from `configTheme`. Every other named theme is
 * a fixed preset and intentionally ignores it, which is what the picker entry
 * "Default (from config)" means. Do not "fix" that.
 */
export function resolvePalette(args: PaletteArgs = {}): JBrowsePalette {
  const { configTheme, themeName = 'default', extraThemes } = args
  const presets: Record<string, PaletteInput> = {
    ...palettePresets,
    ...Object.fromEntries(
      Object.entries(extraThemes ?? {}).map(([k, v]) => [k, v.palette ?? {}]),
    ),
  }
  const preset = presets[themeName] ?? presets.default ?? {}
  const input: PaletteInput =
    themeName === 'default' ? { ...preset, ...configTheme?.palette } : preset

  const mode = input.mode ?? 'light'
  const isDark = mode === 'dark'
  const neutrals = isDark ? darkNeutrals : lightNeutrals
  const brandFallback = isDark ? darkBrandFallback : lightBrandFallback
  const strings: StringColors = {
    ...lightStringColors,
    ...(isDark ? darkStringColors : {}),
  }
  for (const key of Object.keys(strings) as (keyof StringColors)[]) {
    const override = input[key]
    if (override !== undefined) {
      strings[key] = override
    }
  }

  return {
    ...strings,
    mode,
    text: { ...neutrals.text, ...input.text },
    background: { ...neutrals.background, ...input.background },
    divider: input.divider ?? neutrals.divider,
    common: { ...neutrals.common, ...input.common },
    action: { ...neutrals.action, ...input.action },
    primary: augmentColor(input.primary ?? brandFallback.primary),
    secondary: augmentColor(input.secondary ?? brandFallback.secondary),
    tertiary: augmentColor(input.tertiary ?? lightgrey),
    quaternary: augmentColor(input.quaternary ?? lightgrey),
    highlight: augmentColor(input.highlight ?? { main: mandarin }),
    textHighlight: augmentColor(
      input.textHighlight ?? { main: textHighlightYellow },
    ),
    bases: Object.fromEntries(
      (['A', 'C', 'G', 'T', 'N'] as const).map(key => [
        key,
        augmentColor(input.bases?.[key] ?? defaultBases[key]),
      ]),
    ) as Record<BaseKey, ColorQuad>,
    frames: resolveFrames(input.frames, defaultFrames),
    framesCDS: resolveFrames(input.framesCDS, defaultFramesCDS),
    alignmentFill: {
      ...(isDark ? darkAlignmentFill : lightAlignmentFill),
      ...input.alignmentFill,
    },
  }
}
