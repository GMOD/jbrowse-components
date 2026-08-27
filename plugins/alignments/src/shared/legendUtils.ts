// the leaf module, not the `@jbrowse/core/ui` barrel the types come from: this
// file is reached from the display's state model, which a plugin evaluates at
// install time, and a value import of the barrel would put ~80 Material
// components on every host's first paint (see EAGER_BUNDLE.md)
import { PAIR_DIRECTION_LABELS } from '@jbrowse/alignments-core'
import { legendSwatches } from '@jbrowse/core/ui/legendSpec'
import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/palette'

import { bakedValueColor } from '../LinearAlignmentsDisplay/colorTagUtils.ts'
import {
  categorySwatchColor,
  rgb255,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import { OVERLAP_ALPHA } from '../shaders/slang/overlap.consts.generated.ts'
import { isModificationScheme } from './colorSchemes.ts'
import { getModificationName, modificationData } from './modificationData.ts'
import {
  isModificationTypeVisible,
  paintsUnmodifiedState,
  usesMethylationLegend,
} from './types.ts'

import type { RefNamePosition } from '../LinearAlignmentsDisplay/colorTagUtils.ts'
import type {
  ReadColorCategory,
  SwatchCategory,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ReadConnectionsMode } from '../LinearAlignmentsDisplay/constants.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { ArcColorByType, ColorBy, ColorSchemeType } from './types.ts'
import type {
  LegendItem,
  LegendMark,
  LegendSection,
  LegendSwatch,
} from '@jbrowse/core/ui'

export type { LegendItem } from '@jbrowse/core/ui'

// One row per color AND one row per label. A swatch means one thing in a legend
// box, so a color that two vocabularies both produce is keyed once, under the
// first label it got — the arcs' neutral slot and the reads' LR slot are both
// `colorPairLR`, and "Normal" listed under "LR - Normal pair orientation" is the
// same grey twice.
//
// The label rule covers the mirror case, and it is where a row grows a SECOND
// mark rather than losing one: for a bucket the two vocabularies paint in
// *different* colors, keying by color alone lists one label twice, while keying
// by label alone drops whichever color arrived second — off a box whose whole
// claim is that it names every color drawn. Keeping both as marks on one row is
// the only form that is neither repetitive nor a lie. The reads' swatch leads,
// since a pileup fill is what most of the frame shows.
//
// Short insert was the one live instance of that, back when the pileup filled it
// pale and the curves stroked it saturated; both are the saturated pink now, so
// today every shared bucket collapses to a single mark and this arm is
// unexercised by the alignments vocabulary. Kept because the label collision it
// resolves is a property of merging two vocabularies at all, not of that one
// color choice — and because losing a drawn color silently is the failure it
// exists to prevent.
//
// A shared color keeps ONE mark, deliberately, and it is worth saying why it
// isn't a third failure of the same family: the merged row is about what a color
// MEANS, and for a bucket both vocabularies paint identically the meaning is one
// thing. Splitting it into ▪⌒ on every such row — which is most rows, the two
// vocabularies agreeing being the reason they merged at all — would spend the
// label column's width to tell a reader looking straight at a curve that curves
// exist. The marks earn their place where they discriminate: a color only the
// overlay draws opens its own row and keeps its curve, and the connections
// section is curves throughout.
//
// Color-less rows (headings, notes) merge by label only, never by color.
//
// TWO lists, not one concatenation, and that is the half the rules above cannot
// state on their own: they are about what a color means in a DIFFERENT
// vocabulary, so only the arcs are ever folded. Handed the concatenation, the
// same rules also collapsed two READ rows that happen to share a palette entry
// — and three triples do (`{noStrand, nonSplit, mapqUnavailable}` on
// colorNeutralRead, `{pairLR, normalInsert, noTagValue}` on colorPairLR,
// `{supplementary, splitDeletion}` on colorSupplementary), each member a
// distinct bucket the renderer paints for a distinct reason. No scheme emits
// two of one triple today, so nothing was being dropped; the drop would have
// been silent when one did, which is the wrong way round for a box whose claim
// is that it names every color drawn.
function oneRowPerMeaning(
  reads: LegendItem[],
  arcs: LegendItem[],
): LegendItem[] {
  // Copied, because `legendSwatches` hands back the item's OWN array for a row
  // that already carries one — and the merge below pushes onto this.
  const rows: { item: LegendItem; swatches: LegendSwatch[] }[] = reads.map(
    item => ({ item, swatches: [...legendSwatches(item)] }),
  )
  const byColor = new Map<string, number>()
  const byLabel = new Map<string, number>()
  rows.forEach(({ item }, i) => {
    if (!byLabel.has(item.label)) {
      byLabel.set(item.label, i)
    }
    if (item.color !== undefined && !byColor.has(item.color)) {
      byColor.set(item.color, i)
    }
  })
  for (const item of arcs) {
    const at =
      (item.color === undefined ? undefined : byColor.get(item.color)) ??
      byLabel.get(item.label)
    if (at === undefined) {
      byLabel.set(item.label, rows.length)
      if (item.color !== undefined) {
        byColor.set(item.color, rows.length)
      }
      rows.push({ item, swatches: [...legendSwatches(item)] })
    } else if (item.color !== undefined) {
      const row = rows[at]!
      if (!row.swatches.some(s => s.color === item.color)) {
        row.swatches.push({ color: item.color, mark: item.mark })
      }
      // so a third row in this color joins the same one rather than opening its
      // own under the label it happens to carry
      if (!byColor.has(item.color)) {
        byColor.set(item.color, at)
      }
    }
  }
  return rows.map(({ item, swatches }) =>
    swatches.length > 1 ? { ...item, swatches } : item,
  )
}

// "Arc colors" -> "Read and arc colors", keeping whatever noun the overlay
// chose for itself.
function mergedTitle(arcTitle: string) {
  return `Read and ${arcTitle.charAt(0).toLowerCase()}${arcTitle.slice(1)}`
}

// Identity of a legend row for the de-dup below: color and label, joined by a
// character neither can contain.
//
// WRITTEN AS AN ESCAPE, and it has to be. A raw NUL in the source makes the
// whole file "binary" to grep AND to git, neither of which then does its job on
// it. grep prints `binary file matches` and no match text, so core's exports
// generator -- which greps the repo for core import specifiers -- saw none of
// THIS file's imports, dropped `./ui/legendSpec` (imported here and nowhere else
// by that path), and every generator after it in `pnpm autogen` died resolving
// it. git, for its part, cannot three-way merge a binary file, so any rebase
// touching this one conflicts whole-file with nothing to resolve.
// (Nor may this comment SPELL a core specifier -- that same grep would read the
// prose as an import and warn about a module that does not exist.)
const KEY_SEP = '\u0000'

function legendKey(i: Pick<LegendItem, 'color' | 'label'>) {
  return `${i.color}${KEY_SEP}${i.label}`
}

// Every (color, label) a row actually SHOWS, which for a merged row is two —
// and the second one is a color `item.color` does not carry, so keying off that
// field alone let a connection row repeat a swatch verbatim as long as it
// matched the arc's half of the merge rather than the reads'. A color-less row
// keys as itself, since nothing it could collide with has a color either.
function rowKeys(item: LegendItem) {
  const swatches = legendSwatches(item)
  return swatches.length === 0
    ? [legendKey(item)]
    : swatches.map(s => legendKey({ color: s.color, label: item.label }))
}

/**
 * The display's color vocabularies as legend sections: the read fills, the
 * paired-end arc / read-cloud colors, and the linked-read connection curves.
 * The on-screen `FloatingLegend` and the SVG export both build from this one
 * list, so a heading can't appear in one and not the other. Empty sections drop
 * out and titles only appear once more than one survives, so a plain track still
 * shows a single untitled list.
 *
 * Reads and arcs are **one** section whenever they share a color, which is the
 * usual case: both classify pairs, and a shared bucket is the same swatch on
 * both sides. Splitting them there is a false choice between two bad lists — key
 * both fully and the same four swatches appear under two headings, or subtract
 * the shared ones and "Arc colors" lists three colors for arcs that are drawn in
 * seven. Merged and deduped, every drawn color appears exactly once, which is
 * also the most compact form.
 *
 * They stay separate only when the two genuinely disagree (reads by
 * modification, arcs by insert size): no color is then shared, so neither
 * failure is available and the headings say something real.
 *
 * Connections keep their own section — they are a separate overlay with its own
 * dismiss — but not their own copy of a row already keyed above. A paired track
 * in chain mode draws the pair colors as fills AND as connector curves, and the
 * two vocabularies agree word for word, so the box listed "RL - Mates point
 * outward" twice in the same teal, once per section, and likewise RR and LL:
 * three verbatim repeats out of four rows, which reads as a bug rather than as a
 * key. Only an exact color-and-label match is dropped, so a connection color the
 * fills never paint, or one the curves call something else ("Split alignment
 * (inverted)" against the fill's "Split paired-end read (inverted)"), still
 * earns its row.
 */
export function getAlignmentsLegendSections(model: {
  legendItems: () => LegendItem[]
  arcLegendTitle: string
  arcLegendItems: () => LegendItem[]
  bezierLegendItems: () => LegendItem[]
}): LegendSection[] {
  const reads = model.legendItems()
  const arcs = model.arcLegendItems()
  // Color-less rows (headings, notes) never count as a shared color — a `reads`
  // and an `arcs` entry that both omit `color` would otherwise both land on
  // `undefined` and read as a match, merging two sections that share no swatch.
  const readColors = new Set(
    reads.map(i => i.color).filter(c => c !== undefined),
  )
  const merge = arcs.some(a => a.color !== undefined && readColors.has(a.color))
  const readSection = merge
    ? {
        id: 'reads',
        title: mergedTitle(model.arcLegendTitle),
        items: oneRowPerMeaning(reads, arcs),
      }
    : { id: 'reads', title: 'Read colors', items: reads }
  const arcSection = {
    id: 'arcs',
    title: model.arcLegendTitle,
    items: merge ? [] : arcs,
  }
  const keyed = new Set(
    [...readSection.items, ...arcSection.items].flatMap(rowKeys),
  )
  return [
    readSection,
    arcSection,
    {
      id: 'connections',
      title: 'Read connections',
      items: model.bezierLegendItems().filter(i => !keyed.has(legendKey(i))),
    },
  ]
}

function hslRamp(
  saturation: number,
  steps: { hue: number; label: string }[],
): LegendItem[] {
  return steps.map(({ hue, label }) => ({
    color: `hsl(${hue}, ${saturation}%, 50%)`,
    label,
  }))
}

// The label for each fixed-swatch category, in display order — object key order
// is the order, the same way `GROUP_BY_DIMENSIONS`' is its menu order. The
// swatch color is resolved from the live palette (categorySwatchColor), so
// wording is the only thing the legend hard-codes. Categories absent from
// `SwatchCategory` ('plain', 'mapq', 'tag', 'modFwd'/'modRev') are dynamic
// ramps/palettes with no single swatch and are keyed by `schemeLegend` instead.
//
// A `Record<SwatchCategory, …>` and not an array. `colorUtils` calls this pair
// correct BY CONSTRUCTION — "the legend can never list a color the renderer
// didn't paint (or omit one it did)" — and as an array only the first half of
// that held: `swatchPaletteKeys` is exhaustive over the categories, but leaving
// one out HERE compiled. `noStrand` was left out, and nothing said so.
//
// Nothing draws it today, which is why it went unnoticed: `strandCategory`
// emits it for strand 0, and neither feature source this pipeline serves can
// produce one — `SamRecordFeature.strand` is `flags & SAM_FLAG_REVERSE ? -1 : 1`
// and PAF parses `'-' ? -1 : 1`. So this is the latent half of the invariant,
// not a swatch users are missing; `presentCategories` filters the row out until
// something does emit the bucket. The type is the point.
const CATEGORY_LEGEND: Record<SwatchCategory, string> = {
  fwdStrand: 'Forward strand',
  revStrand: 'Reverse strand',
  noStrand: 'Unstranded',
  nonSplit: 'Unsplit read',
  // From the shared table, because the group-by section chips name the same four
  // buckets (`pairOrientationKey`) and a swatch row and the section it labels
  // reading differently is the drift PAIR_DIRECTION_LABELS exists to stop.
  pairLR: PAIR_DIRECTION_LABELS.LR,
  pairRL: PAIR_DIRECTION_LABELS.RL,
  pairLL: PAIR_DIRECTION_LABELS.LL,
  pairRR: PAIR_DIRECTION_LABELS.RR,
  normalInsert: 'Normal',
  longInsert: 'Long insert',
  shortInsert: 'Short insert',
  // What was measured, not what it means. `splitJunctionKind` decides these from
  // the two segments' strands ALONE — never their order, their distance, or even
  // their refName — so a same-strand junction is equally a deletion, a tandem
  // duplication, a templated insertion or a same-strand translocation, and
  // "Split read (deletion)" named one of the four. Same-strand/inverted is the
  // whole of what the classifier knows; the interpretation belongs to the reader
  // (and to the docs), not to a swatch.
  //
  // "Paired-end" is what separates these from the identically-measured
  // `SPLIT_STRAND_LABELS` below, and it is the honest separator because it names
  // the CAUSE of there being two color pairs at all: the two branches are gated
  // on `isPaired`, so a legend showing all four is showing a mixed BAM. Two rows
  // saying "(same strand)" in different colors is then not a collision but the
  // fact — one finding, two kinds of evidence.
  //
  // The arcs and connector curves get `SPLIT_JUNCTION_LABELS` instead: a curve
  // is drawn for split reads of either kind, so it cannot claim pairedness.
  splitInversion: 'Split paired-end read (inverted)',
  splitDeletion: 'Split paired-end read (same strand)',
  interchrom: 'Inter-chromosomal',
  unmappedMate: 'Unmapped mate',
  supplementary: 'Supplementary/split',
  // the two leftover buckets, last: a read whose scheme resolved no value for
  // it. `noTagValue` is named per scheme below (no HP value / no mate).
  mapqUnavailable: 'MAPQ unavailable (255)',
  noTagValue: 'No value',
}

/**
 * How wide this display lets its floating legend grow, against the 200 default.
 *
 * Sized to the longest label the tables here can produce — "Split paired-end
 * read (same strand)" at ~173px in the 10px app font — plus the box's own
 * chrome: 2 border, 3 left padding, 20 for the dismiss "×" gutter, and 32 for a
 * two-mark swatch column, which is 230. `legendWidth.test.ts` measures every
 * label against it, so a new one that would silently ellipsize fails there
 * instead of on someone's screen.
 *
 * The alternative was raising the default for every display in the repo, which
 * spends occlusion over everyone's data to fit one plugin's vocabulary.
 *
 * This is a CEILING, not a width: the box shrink-wraps its content, and the real
 * pileup legend measures 204px in Chrome — Roboto runs a little narrower than
 * the Helvetica table the test estimates from, so the slack is real and in the
 * safe direction. Nothing is occluded that the labels don't need.
 */
export const LEGEND_MAX_WIDTH = 230

// Display order, taken off the exhaustive table above so the two can't be
// separately incomplete.
const CATEGORY_ORDER = Object.keys(CATEGORY_LEGEND) as SwatchCategory[]

// The wording for one category, for consumers outside the legend box that still
// have to name a color bucket — the arc hover tooltip is the first, so the
// tooltip and the swatch beside it cannot say different things about the same
// color. `undefined` for the categories the table deliberately omits (the
// dynamic ramps and palettes: mapq, tag, modifications), which have no single
// swatch and therefore no single name.
//
// `overrides` is `readCategoryLabelOverrides` — the SAME per-scheme rewording
// the legend box applies. Passing it is what keeps this honest under the chain
// framing: the raw table says "Forward strand", and a framed swatch is not about
// the read's own strand, so a consumer that skips the overrides tells the user
// the one thing the legend was just fixed for saying. The read hover is the
// caller that made this matter; the arc hover has no framing to apply and passes
// nothing.
export function readColorCategoryLabel(
  category: ReadColorCategory,
  overrides: Partial<Record<SwatchCategory, string>> = {},
): string | undefined {
  const key = category as SwatchCategory
  return overrides[key] ?? CATEGORY_LEGEND[key]
}

// Under any scheme that colors ordinary reads by something OTHER than their own
// strand (normal, insert size, pair orientation, mapq, modifications, tag …), a
// fwd/rev-strand bucket can only have been produced by the split-read
// (chained-supplementary) branch of readColorCategory — the scheme's own
// classifier yields a different category (plain/mapq/insert/pair/…) for a
// non-split read. Naming these as split reads is what distinguishes the colored
// split segments from the scheme's grey/base-colored non-split reads in
// linked-reads (chain) mode, where only the splits pick up a color.
//
// "Forward"/"reverse" was the wrong axis to name: the branch frames each segment
// against its chain's FRAME (`strand * chainFrame`), so red means agrees with
// the frame and blue means flipped at the junction — the read's own mapping
// strand is not what the color says. A reverse-mapped long read whose segments
// all agree is entirely red.
//
// The frame is the orientation the chains on screen agree on
// (`consensusChainStrandFrames`), not each chain's own primary, which is why the
// labels say neither. On a foldback the primary is arbitrary — the same molecule
// gets either colour depending on which arm the aligner flagged — so a label
// naming it would have been wrong on exactly the data this branch exists for.
//
// That makes this the same measurement as `splitInversion`/`splitDeletion`
// above, run on disjoint data (that branch is unpaired-only, those are
// paired-only) and painted in a different pair of colors — so both wordings land
// in one list on a mixed BAM. They share the parenthetical on purpose, because
// the finding really is the same one; what separates them is the noun, and each
// noun is chosen from what the color is actually painted ONTO.
//
// "Segment", not "read", and the difference is visible in the pileup: here only
// the flipped segment turns blue, while the segments agreeing with the frame
// stay red — every segment takes this branch (`readChainHasSupp` is a
// chain-level value), so one long read shows both colors at once and neither row
// can honestly be about the read. The paired markers
// opposite paint every segment of the split mate one color, so there the row IS
// about the read.
const SPLIT_STRAND_LABELS: Partial<Record<SwatchCategory, string>> = {
  fwdStrand: 'Split segment (same strand)',
  revStrand: 'Split segment (inverted)',
  // the same argument, for the third member of the triple: under a non-strand
  // scheme an unstranded bucket can only have come from that same branch
  noStrand: 'Split segment (strand unknown)',
}

// The first-of-pair-strand scheme colors by the FRAGMENT strand inferred from
// the first mate (read2's strand is inverted), not each read's own strand — so a
// reverse-mapped read1 lands in the "forward" bucket. Spell that out rather than
// reusing the plain "Forward strand" wording of the strand scheme, which would
// read as the read's own strand.
const FIRST_OF_PAIR_LABELS: Partial<Record<SwatchCategory, string>> = {
  fwdStrand: 'Forward (first-in-pair)',
  revStrand: 'Reverse (first-in-pair)',
}

// Per-scheme relabeling of the shared fwd/rev-strand swatches. Every scheme but
// the plain `strand` one reframes fwd/rev as either the fragment strand or a
// split read (see the two maps above).
//
// `strand` keeps CATEGORY_LEGEND's plain wording only while nothing is framing
// it. The framing branch is NOT held off this scheme — it refines it — so in
// chain mode "Forward strand" names a swatch painted on segments that are half
// reverse-mapped, which is the one wording this box must not carry. It reads as
// true here more than anywhere else, because under every other scheme a
// fwd/rev bucket is self-evidently not about the raw strand.
function strandLabelOverrides(
  colorType: ColorSchemeType | undefined,
  chainFramed: boolean,
) {
  return colorType === 'firstOfPairStrand'
    ? FIRST_OF_PAIR_LABELS
    : colorType === 'strand' && !chainFramed
      ? undefined
      : SPLIT_STRAND_LABELS
}

// Per-scheme relabeling of the whole shared swatch table. On top of the strand
// rewording, the CPU-baked schemes name what the leftover neutral bucket means
// in their own terms — a read the tag is absent from, or a block with no mate —
// rather than the bare "No value" the table can't specialize.
export function readCategoryLabelOverrides(
  colorBy: ColorBy | undefined,
  chainFramed: boolean,
): Partial<Record<SwatchCategory, string>> {
  return {
    ...strandLabelOverrides(colorBy?.type, chainFramed),
    ...(colorBy?.type === 'mateRefName' ? { noTagValue: 'No mate' } : {}),
    ...(colorBy?.type === 'tag' && colorBy.tag !== undefined
      ? { noTagValue: `No ${colorBy.tag} value` }
      : {}),
  }
}

// Per-base nucleotide swatches, colored from the live palette base colors.
const BASE_LEGEND: { key: keyof ColorPalette; label: string }[] = [
  { key: 'colorBaseA', label: 'A' },
  { key: 'colorBaseC', label: 'C' },
  { key: 'colorBaseG', label: 'G' },
  { key: 'colorBaseT', label: 'T' },
  { key: 'colorBaseN', label: 'N' },
]

// Tags that encode strand rather than a categorical value; buildReadTagColors
// paints these from the fixed strand colors rather than from the value, so their
// legend is the strand key, not a per-value list.
const STRAND_TAGS = new Set(['XS', 'TS', 'ts'])

// The methylation views key exactly what extractMethylation/extractBisulfite
// paint: 5mC red and 5hmC pink (the blue unmodified swatch is appended by the
// shared path below). The by-type MM palette — a magenta 5hmC — would mismatch
// the reads. Listed in this order rather than in the keyed map's, which is why
// the map is only asked which types survived.
const METHYLATION_STATES = [
  { type: 'm', color: methylated5mC, label: '5mC methylated' },
  { type: 'h', color: methylated5hmC, label: '5hmC methylated' },
]

// `detectedModifications` is populated only from parsed MM/ML tags, so it is
// ALWAYS empty for bisulfite, which is reference-based (read C->T vs. the
// reference) and reads no tags at all. Gating bisulfite on it therefore dropped
// the red 5mC swatch on every bisulfite track. Bisulfite paints exactly one
// modified state, so key it unconditionally instead — before `keyed`, which for
// the same reason has nothing to say about it.
function methylationLegend(
  colorBy: ColorBy,
  keyed: ReadonlyMap<string, string>,
): LegendItem[] {
  if (colorBy.type === 'bisulfite') {
    return [{ color: methylated5mC, label: '5mC methylated' }]
  }
  return [
    ...METHYLATION_STATES.filter(({ type }) => keyed.has(type)).map(
      ({ color, label }) => ({ color, label }),
    ),
    // The fill view is not cytosine-only, and this used to assume it was. The
    // cytosine walk claims 5mC/5hmC; every OTHER type the read declares is
    // drawn here too, by the MM/ML paint in its by-type palette colour (a
    // Fiber-seq read's 6mA — see extractModifications). Keying only the two
    // states above left those marks unexplained, which is the same defect this
    // family already fixed once for two-color's blue.
    //
    // The colour comes from `keyed`, which resolves it through
    // `getColorForModification` — the function the extractor packs the mark
    // with — so the swatch is the drawn colour by construction rather than by a
    // second table.
    ...[...keyed]
      .filter(([type]) => !METHYLATION_STATES.some(s => s.type === type))
      .map(([type, color]) => ({ color, label: getModificationName(type) })),
  ]
}

// Rank of one modification code in `modificationData`. Numeric-looking ChEBI
// codes hoist to the front of an object's key order, so they are ranked after
// the single-letter codes explicitly — otherwise a track carrying pseU and 5mC
// would lead with the rare one.
const MODIFICATION_RANK = new Map(
  Object.keys(modificationData)
    .sort((a, b) => Number(/^\d+$/.test(a)) - Number(/^\d+$/.test(b)))
    .map((type, i) => [type, i]),
)

function modificationRank(type: string) {
  return MODIFICATION_RANK.get(type) ?? MODIFICATION_RANK.size
}

// The modification types this box may key: detected by the MM/ML parse, not
// hidden by the modifications menu, and actually drawn in the reads on screen.
//
// `present` is the same narrowing `bakedValueLegend` applies to tag values, for
// the same reason. The display's `detectedModifications` only ever GROWS — it
// takes each region's types as that region's fetch lands and is never cleared —
// so keying it whole named every type the track had ever seen: pan off the one
// locus carrying 6mA calls and the box still listed 6mA, over reads drawing
// none. Undefined means the caller can't tell (tests, and any consumer without
// a laid-out map), which leaves the detected list alone.
//
// Ordered, so the list is a property of the vocabulary rather than of which
// region's RPC resolved first — the same instability `bakedValueLegend` sorts
// against, and it swapped two rows between renders of one view.
//
// The order is `modificationData`'s own, which is where the name and the colour
// beside it already come from, so a 5mC/5hmC track keeps the reading order it
// has today rather than gaining an alphabetical one. A code absent from that
// table sorts last, by code, since there is nothing else to rank it by.
function keyedModifications(
  colorBy: ColorBy,
  detectedModifications: ReadonlyMap<string, string>,
  present: ReadonlySet<string> | undefined,
) {
  return new Map(
    [...detectedModifications]
      .filter(
        ([type]) =>
          isModificationTypeVisible(colorBy.modifications, type) &&
          (present === undefined || present.has(type)),
      )
      .sort(
        ([a], [b]) =>
          modificationRank(a) - modificationRank(b) || a.localeCompare(b),
      ),
  )
}

// The fixed-swatch buckets actually present in the reads, in CATEGORY_LEGEND
// order. These are cross-cutting: under most schemes they mark exceptions
// layered over the scheme's primary coloring — unmapped mate, inter-chromosomal,
// supplementary, and (in chain mode) the split-read strand framing — so every
// scheme appends them after its own key rather than any one branch owning them.
// fwd/rev are reworded per scheme (split read vs. fragment strand) — see
// strandLabelOverrides.
function bucketItems(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  overrides: Partial<Record<SwatchCategory, string>>,
  mark?: LegendMark,
): LegendItem[] {
  return CATEGORY_ORDER.filter(category => presentCategories.has(category)).map(
    category => ({
      color: categorySwatchColor(category, palette),
      label: overrides[category] ?? CATEGORY_LEGEND[category],
      mark,
    }),
  )
}

/**
 * The overlap mark's row. Two layouts draw this mark and they mean different
 * things by it, so the row differs in the one way a legend row can: chain mode
 * is a COLOR and collapsed rows are a MODIFIER.
 *
 * **Chain (view-as-pairs / linked supplementary): one swatch, the color
 * itself.** Two segments of one molecule cover that span, so no read color is
 * the honest answer there and `overlap.slang` fills it with a theme neutral
 * that is no category (`colorOverlap`). That is nameable the way every other
 * row is, and the swatch is read from the same palette entry the pass paints
 * from — the failure this replaces is a swatch DERIVED from the ink instead of
 * shared with it, which showed the LR grey darkened by `OVERLAP_ALPHA` however
 * the pass was actually painting, and so was a lie in the two directions at
 * once: it named a color the pass didn't paint, and under any scheme but pair
 * orientation it named a pair of colors nothing on screen carried.
 *
 * **Collapsed group rows: two swatches, "this but darker".** There the mark IS
 * a modifier — unrelated reads deliberately share a row, spans are not merged
 * (`collapsedLayout`, and the `mergeSpans` note in the display's CLAUDE.md), so
 * the tint stacks and the darkness is the depth. There is no single swatch to
 * list, because the tint lands on whatever the reads underneath already carry:
 * under an insert-size scheme it darkens five different colors. The neutral
 * read color and that same color tinted is the only honest form, and
 * `LegendItem.swatches` exists for exactly this — one meaning drawn twice.
 *
 * **Composited to an opaque color, not shipped as `rgba(0,0,0,0.4)`.**
 * `LegendSwatchGlyph` emits one `fill` for both the on-screen box and the SVG
 * export, and an alpha fill is not honored by every consumer an exported figure
 * reaches. `OVERLAP_ALPHA` is the shader's own constant (adr-051), so the
 * composite cannot drift from the ink it describes.
 */
function getOverlapLegendItem(
  palette: ColorPalette,
  collapsed: boolean,
): LegendItem {
  if (!collapsed) {
    return {
      color: rgb255(palette.colorOverlap),
      label: 'Pair/chain reads overlap here',
    }
  }
  const [r, g, b] = palette.colorPairLR
  const k = 1 - OVERLAP_ALPHA
  return {
    swatches: [
      { color: rgb255(palette.colorPairLR) },
      { color: rgb255([r * k, g * k, b * k]) },
    ],
    label: 'Overlapping reads (darker = more)',
  }
}

// The mark those colors are drawn AS, once they fold into the read key.
//
// A read cloud is a fill: its connector takes `flatConnectorColor` (the theme
// foreground, no palette slot) and the category color is on the endpoint
// squares, so a line swatch would name the one mark there that is never drawn
// in the color beside it.
function arcMark(mode: ReadConnectionsMode): LegendMark {
  return mode === 'cloud' ? 'fill' : 'curve'
}

// The overlay's wording for the split buckets, "split alignment" throughout
// (reviewer, on both cancer_sv figures: "using the term split alignment might
// help. i like it better than split junction"). It cannot use CATEGORY_LEGEND's,
// which says "paired-end read": a connector is drawn between the segments of ANY
// split read (`readGroupConnections` partitions split alignments from mate links
// without consulting the pair flag), so the paired claim would be false for
// every long read on screen. What a curve marks is the split alignment itself.
// `connectionLabel` derives its wording from THIS table rather
// than restating it, which is what makes "the two overlays agree word for word"
// true by construction — it has to be, because one legend box can show both and
// `getAlignmentsLegendSections` de-dupes them on `${color} ${label}`.
export const SPLIT_JUNCTION_LABELS: Partial<Record<SwatchCategory, string>> = {
  splitInversion: 'Split alignment (inverted)',
  splitDeletion: 'Split alignment (same strand)',
  // The one category CATEGORY_LEGEND names for reads and arcs alike, and the
  // bare "Inter-chromosomal" it carries there is a property of the pair rather
  // than of the mark. On a curve the mark IS the split alignment, so it takes
  // the same noun as the two above and the parenthetical carries the finding.
  interchrom: 'Split alignment (interchromosomal)',
}

// The read-fill scheme each arc coloring mode is the overlay twin of —
// getArcColorType (features/arcs/arcColors.ts) mirrors that scheme's classifier,
// so both paint a bucket the same color. Only 'orientation' is spelled
// differently on the two sides.
const ARC_SCHEME_AS_READ_SCHEME: Record<ArcColorByType, ColorSchemeType> = {
  insertSize: 'insertSize',
  orientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
}

/**
 * Whether the overlay speaks the reads' own color vocabulary — arc mode against
 * its equivalent read scheme, AND every bucket the arcs are actually painting
 * being one the reads are painting too. The swatches are then identical
 * categories in identical palette colors, so keying both sections lists the same
 * colors twice under two headings; the arc buckets fold into the read key
 * instead.
 *
 * The second half is not belt-and-braces, it is the half that was missing.
 * Folding drops the curve mark and renders an arc bucket as a plain read swatch,
 * so it is an assertion that the reads paint that color — and the scheme names
 * alone do not support it, because the arc classifier is not a re-spelling of
 * the read one:
 *
 * - A SPLIT JUNCTION colors by its two segments' strands (`splitInversion` /
 *   `splitDeletion`), whatever the mode, since it has no TLEN and no pair
 *   orientation to classify. The read fills reach those two categories only in
 *   chain mode, so an ordinary pileup of SA-split long reads paints arc buckets
 *   its reads never paint.
 * - `hasPaired` is a property of the whole fetched set, so a track with no
 *   paired reads at all sends every arc down that same branch.
 *
 * (It used to name a different divergence: the arcs folded a pair whose mates
 * were drawn far apart into `longInsert` while the reads read TLEN alone. That
 * rule is gone — `getArcColorType` keys on TLEN and only TLEN now, for the
 * reasons written there — but the check outlives its first example, which is
 * exactly why it is asked of the categories in hand rather than of a table of
 * what each scheme COULD emit.)
 */
export function arcKeyFoldsIntoReadKey({
  arcColorByType,
  readColorScheme,
  arcCategories,
  readCategories,
}: {
  arcColorByType: ArcColorByType
  readColorScheme: ColorSchemeType
  arcCategories: ReadonlySet<ReadColorCategory>
  readCategories: ReadonlySet<ReadColorCategory>
}): boolean {
  return (
    ARC_SCHEME_AS_READ_SCHEME[arcColorByType] === readColorScheme &&
    [...arcCategories].every(c => readCategories.has(c))
  )
}

/**
 * Key for the paired-end arc / read-cloud colors when they are their own
 * vocabulary — insert size or pair orientation while the reads underneath are
 * colored by something else — so those get a legend section of their own. When
 * the overlay mirrors the read scheme the caller merges the buckets into the
 * read key instead (`arcColorsMatchReads`), since the two lists would be the
 * same swatches under two headings. No per-scheme rewording either way: an arc
 * never produces a strand bucket.
 *
 * Always the complete arc key. A partial overlap with the read key is resolved
 * in `getAlignmentsLegendSections`, by merging the two into one deduped list
 * rather than by subtracting here — a section that lists three of the seven
 * colors its own heading names is worse than the repetition it avoids.
 */
export function getArcLegendItems(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  mode: ReadConnectionsMode,
): LegendItem[] {
  return bucketItems(
    presentCategories,
    palette,
    SPLIT_JUNCTION_LABELS,
    arcMark(mode),
  )
}

// The modification family's own key: the methylation views (fill-unmarked and
// bisulfite) key the 5mC/5hmC states, not the per-type MM palette; every other
// modification view keys each detected type in the color the reads use. Both
// append the blue "not modified" swatch whenever the mode paints that state, so
// two-color over a non-cytosine mod (blue low-probability 6mA calls) is keyed
// too — it previously showed only the 6mA swatch, leaving its blue marks
// unexplained.
function modificationLegend(
  colorBy: ColorBy,
  detectedModifications: ReadonlyMap<string, string>,
  presentModifications: ReadonlySet<string> | undefined,
): LegendItem[] {
  const keyed = keyedModifications(
    colorBy,
    detectedModifications,
    presentModifications,
  )
  const isMethylation = usesMethylationLegend(colorBy)
  const items = isMethylation
    ? methylationLegend(colorBy, keyed)
    : [...keyed].map(([type, color]) => ({
        color,
        label: getModificationName(type),
      }))
  return [
    ...items,
    ...(paintsUnmodifiedState(colorBy)
      ? [
          {
            color: unmethylated5mC,
            label: isMethylation ? 'Unmethylated' : 'Unmodified',
          },
        ]
      : []),
  ]
}

// One swatch per value of a CPU-baked scheme (tag values, or mate refNames
// under chromosome painting) that the rendered reads actually carry, colored
// through the same `bakedValueColor` the paint path resolves each read with —
// so a swatch is the color drawn by construction, rather than by a table both
// sides agree to read. Sorted by value, so the order is a property of the
// vocabulary rather than of which region streamed in first.
//
// The values are `presentTagValues` and nothing else. There used to be a second
// source — `colorTagMap`, the display's discovered-value map — which this
// intersected with, because that map only ever grew: pan to chr1 under
// chromosome painting and the key still named chr7 and every scaffold visited
// on the way. With the color a pure function of the value, the map has no
// reason to exist and what is ON SCREEN is the whole answer.
//
// The empty string is what the worker reports for a read the scheme resolved no
// value for (no mate, or the tag absent). Dropped, because it paints the
// neutral fallback rather than a value's color, and `noTagValue` is what keys
// that neutral — under a name.
function bakedValueLegend(
  colorBy: ColorBy,
  present: ReadonlySet<string> | undefined,
  refNamePosition: RefNamePosition | undefined,
): LegendItem[] {
  return [...(present ?? [])]
    .filter(value => value !== '')
    .sort((a, b) => a.localeCompare(b))
    .map(value => ({
      color: bakedValueColor(colorBy, value, refNamePosition),
      label: value,
    }))
}

// XS/TS/ts encode strand rather than a categorical value, so they are keyed by
// the strand pair rather than by discovered values.
function isStrandTag(colorBy: ColorBy | undefined) {
  return (
    colorBy?.type === 'tag' &&
    colorBy.tag !== undefined &&
    STRAND_TAGS.has(colorBy.tag)
  )
}

// A strand tag paints a THIRD color, and the box has to name it: any read whose
// value is neither '+' nor '-' takes colorNeutralRead (buildReadTagColors), and
// a read the tag is absent from arrives here as the empty string
// (extractFeatureTagValue). Two rows was the claim that such a read needs no
// entry — but that neutral is a real fill, drawn over however much of the
// pileup lacks the tag, and it is the one grey `noTagValue` cannot rescue: the
// resolver packs it as a color rather than as 0, so `readColorCategory` files
// those reads under `tag` and the cross-cutting tail never keys them.
//
// Asked of the values on screen, like every other present-gated row, so a track
// whose reads all carry XS gets no row for a fill nothing draws. `undefined`
// means the caller cannot tell, and stays silent rather than guessing a row on.
function hasUnstrandedValue(present: ReadonlySet<string> | undefined) {
  return present !== undefined && [...present].some(v => v !== '+' && v !== '-')
}

// The scheme's own key, before the cross-cutting buckets are appended. Every
// branch returns just its own swatches; nothing here reads presentCategories.
//
// Takes the caller's own bag, minus the fields only the cross-cutting tail
// reads. Six positional arguments of which four are optional maps and sets was
// the alternative, and three of them are the same shape.
type SchemeLegendArgs = Pick<
  ReadDisplayLegendArgs,
  | 'colorBy'
  | 'detectedModifications'
  | 'presentModifications'
  | 'presentTagValues'
  | 'refNamePosition'
> & { palette: ColorPalette }

function schemeLegend({
  colorBy,
  palette,
  detectedModifications,
  presentTagValues,
  presentModifications,
  refNamePosition,
}: SchemeLegendArgs): LegendItem[] {
  // The normal scheme paints every read one flat color ('plain' → colorPairLR),
  // which isn't a CATEGORY_LEGEND bucket, so without an explicit entry its
  // legend would be empty and "Show legend" would render nothing.
  if (colorBy === undefined || colorBy.type === 'normal') {
    return [{ color: rgb255(palette.colorPairLR), label: 'Reads' }]
  }
  const colorType = colorBy.type
  if (isStrandTag(colorBy)) {
    return [
      { color: rgb255(palette.colorFwdStrand), label: 'Forward strand' },
      { color: rgb255(palette.colorRevStrand), label: 'Reverse strand' },
      ...(hasUnstrandedValue(presentTagValues)
        ? [
            {
              color: rgb255(palette.colorNeutralRead),
              label: `No ${colorBy.tag} value`,
            },
          ]
        : []),
    ]
  }
  if (colorType === 'tag' || colorType === 'mateRefName') {
    return bakedValueLegend(colorBy, presentTagValues, refNamePosition)
  }
  if (colorType === 'mappingQuality') {
    // Ramp stops, not buckets: hue IS the score in degrees (categoryColor /
    // read.slang's hueRampHalfSat), so 60 is a stop on a continuous sweep and
    // not a ceiling — a MAPQ 70 read from an aligner that emits past bwa/
    // minimap2's cap of 60 paints its own distinct hue. The old '≥60' claimed
    // otherwise. The 255 sentinel is not on this ramp at all; it classifies as
    // `mapqUnavailable` and is keyed by the cross-cutting buckets, so it appears
    // only when reads actually carry it.
    return hslRamp(50, [
      { hue: 0, label: 'MAPQ 0' },
      { hue: 30, label: 'MAPQ 30' },
      { hue: 60, label: 'MAPQ 60' },
    ])
  }
  if (colorType === 'perBaseQuality') {
    return hslRamp(55, [
      { hue: 0, label: 'BQ 0' },
      { hue: 15, label: 'BQ 10' },
      { hue: 30, label: 'BQ 20' },
      { hue: 45, label: 'BQ 30' },
      { hue: 60, label: 'BQ 40' },
    ])
  }
  if (colorType === 'perBaseLetter') {
    return BASE_LEGEND.map(({ key, label }) => ({
      color: rgb255(palette[key]),
      label,
    }))
  }
  if (isModificationScheme(colorType)) {
    return modificationLegend(
      colorBy,
      detectedModifications ?? new Map(),
      presentModifications,
    )
  }
  // The strand / insert-size / orientation schemes are described entirely by
  // which fixed-swatch buckets occurred.
  return []
}

// The display-supplied half of the legend's inputs — everything but the live
// palette and the bucket scan, which the two consumers below split differently.
interface ReadDisplayLegendArgs {
  colorBy: ColorBy | undefined
  detectedModifications?: ReadonlyMap<string, string>
  // Which overlap tint is on screen, or undefined for none — the display's
  // `overlapLegendKind`, which is the draw gate and a real overlap interval,
  // not just the layout. Last in the list because it modifies the colors above
  // it rather than adding one.
  overlaps?: 'chain' | 'collapsed'
  // Whether the unpaired chain-strand framing is live — `framesUnpairedChainStrand`
  // in the display, which is the same predicate that gates the consensus pass.
  // Only the `strand` scheme's wording turns on it; every other scheme already
  // words fwd/rev as something other than the read's own strand.
  chainFramed?: boolean
  // Values the rendered reads carry, for the CPU-baked schemes — the display's
  // `presentTagValues`, and the whole swatch list for those schemes. Undefined
  // means "not known here" and keys none; the empty set means the scheme has
  // values and none are on screen, which lists none either.
  presentTagValues?: ReadonlySet<string>
  // The same, for the modification types drawn on screen — the display's
  // `presentModifications`, off the marks rather than off the MM/ML parse.
  presentModifications?: ReadonlySet<string>
  // The display's `paintedRefNamePosition`, so a chromosome-painting swatch is
  // drawn by the same rule the reads are — hand the palette out by assembly
  // position, hash only where the order is unknown. Omitting it here is how the
  // box would key a colour no read paints.
  refNamePosition?: RefNamePosition
}

/**
 * Legend items for the alignments display: the active scheme's own key followed
 * by the cross-cutting buckets (unmapped mate, inter-chromosomal, supplementary,
 * split reads in chain mode) that actually occurred. `presentCategories` is the
 * set of read buckets seen in the rendered reads (from readColorCategory), so
 * only relevant swatches are listed, and `palette` is the live render palette so
 * swatch colors match the painted reads exactly. Modification swatches come from
 * `detectedModifications` (type code -> painted color), narrowed by
 * `presentModifications` because that map only ever grows. Tag /
 * chromosome-painting swatches are `presentTagValues` itself, colored through
 * the same pure function the reads are painted with; mapping/per-base quality
 * are fixed hue ramps.
 */
export function getReadDisplayLegendItems({
  colorBy,
  presentCategories,
  palette,
  detectedModifications,
  presentTagValues,
  presentModifications,
  refNamePosition,
  chainFramed = false,
  overlaps,
}: ReadDisplayLegendArgs & {
  palette: ColorPalette
  presentCategories: ReadonlySet<ReadColorCategory>
}): LegendItem[] {
  // A strand tag keys fwd/rev itself, in those exact colors, so drop them from
  // the cross-cutting tail rather than listing the same two swatches again
  // under split-read wording.
  const categories = isStrandTag(colorBy)
    ? new Set(
        [...presentCategories].filter(
          c => c !== 'fwdStrand' && c !== 'revStrand',
        ),
      )
    : presentCategories
  return [
    ...schemeLegend({
      colorBy,
      palette,
      detectedModifications,
      presentTagValues,
      presentModifications,
      refNamePosition,
    }),
    ...bucketItems(
      categories,
      palette,
      readCategoryLabelOverrides(colorBy, chainFramed),
    ),
    ...(overlaps === undefined
      ? []
      : [getOverlapLegendItem(palette, overlaps === 'collapsed')]),
  ]
}
