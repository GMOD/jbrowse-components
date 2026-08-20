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
  /** The other end of the pair aligned nowhere, so no orientation is honest */
  unmappedMate: string
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
      `palette color needs a \`main\` or a \`500\` shade, got ${JSON.stringify(
        input,
      )}`,
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

const green = {
  300: '#81c784',
  400: '#66bb6a',
  500: '#4caf50',
  700: '#388e3c',
  800: '#2e7d32',
  900: '#1b5e20',
}
const blue = { 300: '#64b5f6', 500: '#2196f3', 700: '#1976d2' }
const orange = {
  300: '#ffb74d',
  400: '#ffa726',
  500: '#ff9800',
  700: '#f57c00',
  900: '#e65100',
}
const red = {
  300: '#e57373',
  400: '#ef5350',
  500: '#f44336',
  700: '#d32f2f',
  800: '#c62828',
}
const lightBlue = {
  300: '#4fc3f7',
  400: '#29b6f6',
  500: '#03a9f4',
  700: '#0288d1',
  900: '#01579b',
}
const brown = { 300: '#a1887f', 500: '#795548', 700: '#5d4037' }
export const grey = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#eeeeee',
  300: '#e0e0e0',
  400: '#bdbdbd',
  500: '#9e9e9e',
  600: '#757575',
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
  grey: typeof grey
  action: {
    active: string
    hover: string
    hoverOpacity: number
    selected: string
    selectedOpacity: number
    disabled: string
    disabledBackground: string
    disabledOpacity: number
    focus: string
    focusOpacity: number
    activatedOpacity: number
  }
}

/**
 * The four states a UI conveys with color rather than with words. Not domain
 * colors — nothing renders a feature in `warning.main` — but the styling
 * layer's, and JBrowse's own rather than borrowed from Material UI at read
 * time, for the same reason every other color here is.
 */
export interface SemanticColors {
  error: ColorQuad
  warning: ColorQuad
  info: ColorQuad
  success: ColorQuad
}

// Material's own semantic stops, one set per mode. Stated with explicit
// light/dark shades because MUI states them that way: `warning.main` in light
// mode is not orange[800] but the nearest value that passes 3:1 against white.
const lightSemantics = {
  error: { main: red[700], light: red[400], dark: red[800] },
  warning: { main: '#ed6c02', light: orange[500], dark: orange[900] },
  info: { main: lightBlue[700], light: lightBlue[500], dark: lightBlue[900] },
  success: { main: green[800], light: green[500], dark: green[900] },
} satisfies Record<keyof SemanticColors, ShadeInput>

const darkSemantics = {
  error: { main: red[500], light: red[300], dark: red[700] },
  warning: { main: orange[400], light: orange[300], dark: orange[700] },
  info: { main: lightBlue[400], light: lightBlue[300], dark: lightBlue[700] },
  success: { main: green[400], light: green[300], dark: green[700] },
} satisfies Record<keyof SemanticColors, ShadeInput>

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
  grey,
  action: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    hoverOpacity: 0.04,
    selected: 'rgba(0, 0, 0, 0.08)',
    selectedOpacity: 0.08,
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    disabledOpacity: 0.38,
    focus: 'rgba(0, 0, 0, 0.12)',
    focusOpacity: 0.12,
    activatedOpacity: 0.12,
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
  grey,
  action: {
    active: '#fff',
    hover: 'rgba(255, 255, 255, 0.08)',
    hoverOpacity: 0.08,
    selected: 'rgba(255, 255, 255, 0.16)',
    selectedOpacity: 0.16,
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
    disabledOpacity: 0.38,
    focus: 'rgba(255, 255, 255, 0.12)',
    focusOpacity: 0.12,
    activatedOpacity: 0.24,
  },
}

// ---------------------------------------------------------------------------
// Static domain colors
//
// Colors that do not vary with the theme. Already plain strings, already
// imported directly by worker code, kept here so every color in the system has
// one home. `theme.ts` re-exports them, so existing imports are unaffected.
// ---------------------------------------------------------------------------

/** #color alignments-strand | Forward strand | Read maps to the forward strand */
export const colorFwdStrand = '#EC8B8B'
/** #color alignments-strand | Reverse strand | Read maps to the reverse strand */
export const colorRevStrand = '#8F8FD8'
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
// Was `colorNostrand`, which named the one thing it essentially never paints. A
// SAM record's strand is DEFINED from the reverse flag inside the adapter's
// feature class (`SamRecordFeature.strand`), so it is always +1 or -1, and a
// PAF/synteny block carries a real strand too — `strandCategory`'s `noStrand`
// branch is the defensive third case of a `-1 | 0 | 1` return, not a category
// an alignments track produces. The name survived because the two places that
// DO reach 0 are strand questions of a different kind: a sashimi junction whose
// spliced reads carry no XS/TS/ts tag (ordinary unstranded RNA-seq), and a
// strand-valued read tag that a read simply lacks.
//
// What it actually paints, in volume, is neither — `nonSplit` ("Unsplit read",
// the majority of a pileup under the split-read scheme) and `mapqUnavailable`
// (MAPQ 255). What unites all five is that the scheme's question has no
// informative answer for this read, so the value is the neutral it falls back
// to rather than a statement about strand.
//
// It is NOT the only such neutral: `colorPairLR` #d3d3d3 is the baseline for
// `normalInsert`, `noTagValue` and `plain`, and the two sit dE 3.95 apart —
// close enough that `readTagColors.ts` moved its untagged-read case off this one
// and onto that one, because only that one darkens under the dark theme. Whether
// two neutrals are wanted at all is the open question here; this rename does not
// settle it, and the dark-mode half is `agent-docs/TODO.md`.
export const colorNeutralRead = '#c8c8c8'
/**
 * #color alignments-pair-orientation | Inter-chromosomal | Mate maps to a different chromosome; colored distinctly rather than by orientation
 * #color alignments-insert-size | Mate on a different chromosome | Suggests an inter-chromosomal event
 */
// THIS SLOT AND `colorUnmappedMate` WERE CHOSEN TOGETHER, and reading either one
// alone is how the previous pair got stuck. Both are warm, both belong to all
// three mate-aware schemes, and at #6e4b3a / #b05a20 they sat 4.5 degrees apart
// in hue — which left this one nowhere to go in any direction, because every
// direction was that one:
//
//   more chroma at the same L*   -> dE 38.0 to unmappedMate becomes 20.7
//   lighter                      -> dE 11.8 to it, then the greys past that
//   darker                       -> the complaint, worse
//   another hue                  -> the two schemes hold nine, and the widest
//                                   gap is 91 degrees between pairLL and pairRL,
//                                   whose midpoint reads as a second green-blue
//
// So it was the darkest slot in either scheme (L* 35.3 against 41.2 next) AND
// the dullest (C* 20.4 against 34.6), which together is what "reads as a smudge"
// means. Reported on `cancer_sv/k562_bcr_abl_split`: "the arcs for the
// interchromosomal reads are very dark". The tell is a 2 px stroke — at that
// weight it was the only colour in either scheme that disappeared, while as a
// large flat read fill it was merely dull. This slot has to survive both.
//
// The fix is that unmappedMate left the warm family (see its own note), which
// opens the band this now takes: L* 44.9, C* 60.1, and dE 42.2 to its nearest
// neighbour — the pale supplementary tan — where it used to be 30.1 to a grey.
// Contrast 5.39 on paper and 3.48 on #121212 puts it mid-pack on both grounds
// rather than worst on either; it was 2.44 on dark, the worst in the palette.
//
// Hue 51.7 keeps it clear of `colorLongInsert` at 40, which is the one warm
// neighbour that must not be confusable: red means "insert too long", and a
// second red would read as a second statement about insert size.
export const colorInterchrom = '#af4d19'
/** #color alignments-insert-size | Insert larger than expected | Suggests a deletion spanning the pair */
export const colorLongInsert = '#ff0000'
/** #color alignments-insert-size | Insert smaller than expected | Suggests an insertion between the pair */
// This slot has TWO neighbours it must stay clear of, and every past value has
// solved one by walking into the other. They sit at opposite ends of the
// lightness axis, which is what makes it a balance rather than a direction:
//
//   colorLongInsert  #ff0000   L* 53.2   C* 104.6   h  40   <- must not read as
//   colorPairLR      #d3d3d3   L* 84.6   C*   0.0          <- must not vanish on
//
// 31 L* apart, so no pink can be more than about 16 from each. The history is
// four attempts at spending that budget:
//
//   #ffc0cb   L* 83.6  C* 24.4  h   8   pale: red's own hue washed out, read as
//                                       "washed-out red" beside it
//   #ff3a8c   L* 58.2  C* 76.9  h   1   saturated: 5 L* from red, same warm end
//                                       of the wheel, so chroma could not part
//                                       them (review, twice)
//   #ffbcd8   L* 83.0  C* 28.6  h 351   light: 30 L* from red -- and 1.5 L* from
//                                       the grey baseline, separated from it by
//                                       chroma alone
//   #f582c0   L* 68.9  C* 52.7  h 346   this
//
// The third is the one to understand, because it looks like the fix and is the
// reason this comment is long. It maximised the distance from red by spending
// the entire budget, so it arrived at the grey. Measured against that grey it
// is dE 28.6, the closest any categorized slot comes -- and the margin is pure
// chroma, which is the weakest channel there is on a 1px arc stroke. It is also
// contrast 1.56 against paper, against grey's own 1.50: a short-insert arc was
// very nearly as faint as the concordant ones it had to be picked out from.
// Reported as "i cant see pink short insert on grey very well", which is
// exactly what those two numbers say.
//
//                        dE vs red   dE vs grey   contrast on paper
//   #ffbcd8 (was)             93.4         28.6   1.56
//   #f582c0 (this)            86.2         54.9   2.38
//
// So: 15.7 L* from red -- three times the gap the rejected saturated value had,
// on the axis that review was about -- while nearly doubling the separation
// from grey and half again the contrast against the page. Hue 346 keeps it on
// the magenta side of red rather than #ffc0cb's hue 8, so what lightness cannot
// finish, hue does.
//
// Both neighbours have to be re-checked together if this is touched again. It
// is also a READ FILL, not only an arc stroke, so a value has to survive being
// a large flat area as well as a hairline; C* 52.7 puts it in the same band as
// colorPairLL (52.0) and colorSupplementary (42.1) rather than shouting past
// them.
export const colorShortInsert = '#f582c0'
/**
 * #color alignments-pair-orientation | Mate unmapped | The other end of the pair aligned nowhere, so orientation and insert size say nothing
 * #color alignments-insert-size | Mate unmapped | The other end of the pair aligned nowhere, so insert size says nothing
 */
// A NON-COLOUR, at the dark end of the neutral scale on BOTH themes. It takes
// the first half of the `readOverlap` pattern and not the second, and that split
// is the thing to understand here.
//
// The half it takes is the reason that note gives for being a neutral at all:
// "no read color is the honest answer there, which is the whole reason the span
// is marked". An unmapped mate is the same kind of fact — nothing about the
// pair's geometry is answerable, so a hue would claim a category where there is
// an absence. This slot briefly took a teal in the last free hue region, which
// worked on every number and was the wrong answer: rendered against a pileup a
// hue reads as one more findable category beside the green LL and blue RR bars,
// where a neutral reads as a mark that is deliberately not one of them.
//
// The half it does NOT take is the inversion, and the difference is EXTENT.
// Overlap marks a SPAN INSIDE a read, so a charcoal span on a dark track is a
// gap in a mark that should be continuous — the read looks cut, which is a claim
// about the data. This fills a WHOLE read, which has its own boundary and the
// rows above and below it, so a dark grey reads as a dim read and not as a hole.
//
// So the statement is the same on both themes and only the room differs:
//
//   on #ffffff  #000000  contrast 21.0. The extreme is free, because dE 36.1
//                        from `readOverlap` #555555 is the only other dark
//                        neutral a read fill sits beside. Near-black is not
//                        free: #2e2e2e is dE 17.2 from that charcoal and
//                        #3d3d3d is 10.4, so on this ground it is the extreme
//                        or nothing.
//   on #121212  #4a4a4a  contrast 2.11. Here the extreme collides with the
//                        GROUND — black is 1.12 against it and so is #1e1e1e,
//                        i.e. everything from black up to #1e1e1e sits inside
//                        the ground's own noise and paints a hole. So the value
//                        walks up the same axis exactly as far as it takes to be
//                        a block and stops, at L* 31.5, still the darkest fill
//                        in either scheme by 9.7 L* (`colorPairRR` is next).
//
// Judged as a swatch #3a3a3a also clears the ground, at 1.65. Rendered as a
// pileup it does not: at a 4 px row height it carries the same weight as the
// gaps between rows and cannot be found. A few px of row is what a value here
// has to survive, not a 40 px square.
//
// The nearest dark-mode neighbour is the coverage histogram's grey[700] #616161
// at dE 9.7, which is not a collision in the sense the numbers above are about:
// coverage is a bar in a different subtrack, never a fill a read can take, so
// nothing is ever read against it.
//
// White was the previous dark value, and it reads as the loudest thing in a dark
// pileup — louder than the coloured categories it is meant to be quieter than —
// which is the "glaring near-white blocks" failure `colorPairLRDark` already
// exists to avoid. Going dark also drops the one real cost white carried, dE 9.4
// to `readOverlap`'s dark #e4e4e4 — which the note that shipped it called dE 7,
// wrongly: #e4e4e4 is L* 90.5 and white is L* 100, on a pair separated by
// lightness alone.
//
// The dark end is affordable at all because this slot has the loosest
// requirements in the palette: it is a READ FILL ONLY, in neither
// `ARC_SLOT_CATEGORY` nor `LINKED_READ_SLOT_CATEGORY`, so it never has to
// survive a hairline stroke.
//
// IGV goes further than any of this: `setPairOrientation` requires
// `mate.isMapped()`, so an unmapped mate falls through every branch and takes
// the default read colour. Going that far loses the one thing the category is
// for — under insert size, tlen is 0 and would otherwise paint
// `colorShortInsert`, a false claim — so it keeps a mark, and makes the mark a
// non-colour.
export const colorUnmappedMate = '#000000'
// See colorUnmappedMate: the same dark neutral, lifted off the #121212 ground by
// the least that still reads as a read rather than as a hole.
export const colorUnmappedMateDark = '#4a4a4a'
export const colorLongreadInv = '#7755bb'
/** #color alignments-pair-orientation | Split paired-end read (inverted) | A paired read's supplementary segment maps opposite-strand to its primary, so the junction is inverted — an inversion or an inverted duplication */
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

/**
 * #color theme-colors | Feature (default) | A feature with no color of its own — no `color` slot, no BED itemRgb
 *
 * What an uncolored feature is painted. Lives here rather than in the display
 * that draws most of them because it is not one display's default: the
 * single-feature variant display resolves it through `plugins/canvas`, and the
 * multi-sample variant display's lane bakes it into the color array its worker
 * ships. Two copies of a color two displays are supposed to agree on is exactly
 * the "never a fallback copy" this module exists to prevent.
 */
export const featureDefaultColor = 'goldenrod'

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
  /** Span where two segments of one molecule both align (view-as-pairs / chains) */
  readOverlap: string
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
  /**
   * Minor coordinate gridlines inside a plot area, e.g. the dotplot's. Lighter
   * than the genome gridlines above: a 2D grid crosses itself, so it lays down
   * far more ink at the same alpha than one running behind a linear genome
   */
  plotGridlineMinor: string
  /** Major coordinate gridlines inside a plot area. See plotGridlineMinor */
  plotGridlineMajor: string
  /**
   * Line marking a chromosome or region boundary, well above both plot gridline
   * weights: it is the landmark the coordinates hang off, so it has to stay
   * readable as a boundary on a plot that also draws a full grid
   */
  regionBoundary: string
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
/**
 * #color alignments-indicators | Overlapping segments of one molecule | Both reads of a pair, or both arms of a split read, align here — so the junction between them is this span rather than a point
 *
 * Deliberately NOT a hue, and deliberately outside the categorical greys.
 * Without a mark the two segments paint over each other and the display shows a
 * clean junction at whichever coordinate the later one starts, which is a
 * precise claim about a breakpoint that the data does not make. Painting the
 * span as a darker version of either segment's color says "more of that one",
 * which is the same lie louder — on a foldback the arms are opposite-strand
 * red and blue, and darkening whichever drew last reads as extra-inverted.
 *
 * So the value has one job: read as NEITHER segment. Every categorized grey in
 * the alignments vocabulary is light (`colorPairLR` #d3d3d3, `colorNeutralRead`
 * #c8c8c8, and `colorPairLRDark` #8a8a8a on the dark theme), so this sits past
 * the dark end of them in light mode and past the light end in dark mode,
 * which is also why it inverts rather than dimming: on a dark track background
 * a charcoal span is the background showing through, i.e. a gap where the mark
 * should be.
 */
const readOverlap = '#555555'
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
  readOverlap,
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
  // a plot area's own coordinate grid, and the region boundary that has to read
  // as a landmark through it — three steps apart on purpose, so the boundary is
  // never mistaken for a major and the grid stays under the data
  plotGridlineMinor: 'rgba(0,0,0,0.06)',
  plotGridlineMajor: 'rgba(0,0,0,0.13)',
  regionBoundary: 'rgba(0,0,0,0.42)',
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
  plotGridlineMinor: 'rgba(255,255,255,0.05)',
  plotGridlineMajor: 'rgba(255,255,255,0.1)',
  regionBoundary: 'rgba(255,255,255,0.3)',
  featureHover: 'rgba(255,255,255,0.25)',
  featureHoverStrong: 'rgba(255,255,255,0.4)',
  featureSelected: 'rgba(120,180,255,0.9)',
  // plain CSS 'blue' reads as near-black against a dark track
  featureDescription: blue[300],
  // the deletion rect replaces the read on the dark track background, where the
  // mid-grey #808080 reads as a muddy block, so lighten it
  deletion: '#c8c8c8',
  // inverted rather than dimmed, for the reason on the light value: the mark
  // has to be the one neutral no read category paints, and on a dark track that
  // is the light end. Clear of the dark theme's own `colorPairLRDark` #8a8a8a
  // and of `colorNostrand` #c8c8c8, the two lightest fills it can land beside.
  readOverlap: '#e4e4e4',
}

const lightAlignmentFill: AlignmentFill = {
  pairLR: colorPairLR,
  pairRL: colorPairRL,
  pairLL: colorPairLL,
  pairRR: colorPairRR,
  unmappedMate: colorUnmappedMate,
}

// pairLR because the light #d3d3d3 reads as glaring near-white blocks;
// unmappedMate because its black is inside the #121212 ground's own noise and
// paints a hole (see its own note)
const darkAlignmentFill: AlignmentFill = {
  ...lightAlignmentFill,
  pairLR: colorPairLRDark,
  unmappedMate: colorUnmappedMateDark,
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
export interface JBrowsePalette
  extends StringColors, NeutralTokens, SemanticColors {
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
  error?: ShadeInput
  warning?: ShadeInput
  info?: ShadeInput
  success?: ShadeInput
  bases?: Partial<Record<BaseKey, ShadeInput>>
  frames?: FrameTuple<ShadeInput>
  framesCDS?: FrameTuple<ShadeInput>
  alignmentFill?: Partial<AlignmentFill>
  text?: Partial<NeutralTokens['text']>
  background?: Partial<NeutralTokens['background']>
  divider?: string
  common?: Partial<NeutralTokens['common']>
  grey?: Partial<NeutralTokens['grey']>
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
  const semantics = isDark ? darkSemantics : lightSemantics
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
    grey: { ...neutrals.grey, ...input.grey },
    action: { ...neutrals.action, ...input.action },
    primary: augmentColor(input.primary ?? brandFallback.primary),
    secondary: augmentColor(input.secondary ?? brandFallback.secondary),
    error: augmentColor(input.error ?? semantics.error),
    warning: augmentColor(input.warning ?? semantics.warning),
    info: augmentColor(input.info ?? semantics.info),
    success: augmentColor(input.success ?? semantics.success),
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
