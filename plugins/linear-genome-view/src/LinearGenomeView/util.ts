import {
  UnknownRefNameError,
  assembleLocStrings,
  getTickDisplayStr,
  measureText,
  parseBpString,
  parseLocString,
} from '@jbrowse/core/util'
import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { tickLabelsWorthDrawing } from '@jbrowse/core/util/tickLabels'

import type { AssemblyManager, ParsedLocString } from '@jbrowse/core/util'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Region } from '@jbrowse/core/util/types'

/**
 * The stored viewport of a view showing `totalBp` of displayed regions fitted to
 * `width` — the regions filling it edge to edge, and centered in it only where
 * they are too narrow to fill it.
 *
 * **This is where the fit-to-width rule is written.** `fitAllRegions` takes its
 * scale from here rather than restating it, so the two cannot drift; a second
 * spelling of `max(minBpPerPx * width, totalBp)` reading `MIN_BP_PER_PX` where
 * the action reads the `minBpPerPx` GETTER would agree only for as long as
 * nothing overrides it.
 *
 * The reason it is a function at all is `windowStartBp`, which `fitAllRegions`
 * does not need (it centers in pixels, through `scrollTo`, which also clamps).
 * A caller building a view SNAPSHOT does: it has no model to call
 * `fitAllRegions()` on, and naming `bpPerPx`/`offsetPx` instead is dropped
 * whenever the snapshot also carries a `windowWidthBp` — which one copied off an
 * existing view always does. plugin-canvas's collapsed-intron launch is that
 * caller. A live view calls `fitAllRegions()`.
 *
 * `width` enters only through the zoom-in floor, which bites for a region set
 * narrower than `width * minBpPerPx`; the window itself is in bp and needs no
 * width, which is why a snapshot can carry it at all.
 */
export function fitAllRegionsWindow(
  totalBp: number,
  width: number,
  minBpPerPx: number,
) {
  const windowWidthBp = Math.max(minBpPerPx * width, totalBp)
  // the same centering as getCenteredOffsetPx: half the width the content leaves
  // unfilled, which is zero whenever the fit above is exact
  return { windowWidthBp, windowStartBp: (totalBp - windowWidthBp) / 2 }
}

/**
 * Expand a region by a grow factor, adding padding on each side.
 *
 * @param start - region start coordinate
 * @param end - region end coordinate
 * @param grow - multiplier for expansion (e.g., 0.2 adds 20% padding on each
 * side)
 * @param minBound - minimum bound to clamp start to (default 0)
 * @param maxBound - maximum bound to clamp end to (default Infinity)
 * @returns object with expanded start and end coordinates
 */
export function expandRegion(
  start: number,
  end: number,
  grow: number,
  minBound = 0,
  maxBound = Infinity,
) {
  const len = end - start
  const margin = len * grow
  return {
    start: Math.max(minBound, start - margin),
    end: Math.min(maxBound, end + margin),
  }
}

/**
 * Generate tick positions for the overview scalebar. Anchors at the first neat
 * majorPitch multiple strictly inside the block so ticks land on round numbers
 * regardless of where the block starts/ends.
 */
export function makeOverviewTicks(
  start: number,
  end: number,
  bpPerPx: number,
  reversed = false,
) {
  // A zero (or negative) scale has no tick pitch to speak of, and this loop is
  // sized in bp: chooseGridPitch bottoms out at 5bp, so a chromosome-length
  // region would ask for tens of millions of ticks and hang. createOverviewLayout
  // reports bpPerPx 0 whenever the overview's width collapses to 0 or less —
  // a view narrower than its own chromosome-name gutter, or a caller that sets
  // width directly (jbrowse-img) rather than through useWidthSetter, which
  // filters 0 out.
  if (!(bpPerPx > 0)) {
    return []
  }
  const { majorPitch } = chooseGridPitch(bpPerPx, 120, 15)
  const firstTick = reversed
    ? Math.floor((end - 1) / majorPitch) * majorPitch
    : Math.ceil((start + 1) / majorPitch) * majorPitch
  const numTicks = reversed
    ? Math.floor((firstTick - start - 1) / majorPitch) + 1
    : Math.floor((end - firstTick) / majorPitch) + 1
  return Array.from({ length: Math.max(0, numTicks) }, (_, i) => {
    const genomicCoord = reversed
      ? firstTick - i * majorPitch
      : firstTick + i * majorPitch
    const offsetPx =
      bpOffsetInRegion({ start, end, reversed }, genomicCoord) / bpPerPx
    return { genomicCoord, offsetPx }
  })
}

export interface Tick {
  type: 'major' | 'minor'
  base: number
}

/**
 * Ticks for one span of the ruler. Not the dotplot's same-named function, which
 * walks static blocks into a single continuous axis and therefore has to dedupe
 * the shared block seam and carry each tick's px. Here every block draws its own
 * clipped ruler, so this overscans its span instead of deduping and leaves px to
 * `makeBlockTicks`. What the two do share is already shared: `chooseGridPitch`,
 * and `base` as the 0-based coordinate that `getTickDisplayStr` labels `base+1`.
 */
export function makeTicks(
  start: number,
  end: number,
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
): Tick[] {
  // Ask for the ~200px spacing this ruler actually wants, and mark majors at
  // that pitch. This used to ask for 60px and then mark majors every *two*
  // pitches, which spaced them the same but off chooseGridPitch's 1/2/5 ladder:
  // doubling a ladder value yields 4×10ⁿ half the time, so the scalebar numbered
  // 4000/8000/12000 rather than 5000/10000/15000. The overview scalebar
  // (makeOverviewTicks) and the dotplot's ruler both already read majorPitch
  // straight, which is the contract chooseGridPitch documents.
  const { majorPitch, minorPitch } = chooseGridPitch(bpPerPx, 120, 15)

  // pad 20px on each side so label ends that spill slightly outside the region
  // still draw
  const margin = 20 * bpPerPx
  const minBase = start - margin + 1
  const maxBase = end + margin + 1

  const iterPitch = minorPitch || majorPitch
  const ticks: Tick[] = []
  for (
    let base = Math.floor(minBase / iterPitch) * iterPitch;
    base < Math.ceil(maxBase / iterPitch) * iterPitch + 1;
    base += iterPitch
  ) {
    if (emitMinor && base % majorPitch) {
      ticks.push({ type: 'minor', base: base - 1 })
    } else if (emitMajor && !(base % majorPitch)) {
      ticks.push({ type: 'major', base: base - 1 })
    }
  }
  return ticks
}

/** A block's refName, or undefined for non-content (elided/padding) blocks. */
export function getBlockRefName(block: BaseBlock) {
  return block.type === 'ContentBlock' ? block.refName : undefined
}

/**
 * For blocks in display order, returns whether each block's refName should be
 * labeled: true only for the first block of each run of same-refName regions,
 * so a refName is shown once instead of repeated at every region boundary (e.g.
 * collapsed introns produce many adjacent same-refName regions).
 *
 * A block with no refName ends the run. What an elided block hides is *other
 * chromosomes*, so the same name reappearing on its far side starts a region the
 * reader needs named again, not a continuation of the one before it. Regions lay
 * out contiguously, so an elided run is the only nameless block that can fall
 * between two content blocks — the boundary pads only bracket the whole set,
 * where ending a run changes nothing.
 */
export function showRefNameLabels<T>(
  blocks: T[],
  getRefName: (block: T) => string | undefined,
) {
  let prev: string | undefined
  return blocks.map(block => {
    const refName = getRefName(block)
    const show = refName !== undefined && refName !== prev
    prev = refName
    return show
  })
}

/**
 * A maximal run of adjacent content blocks sharing one refName — the span a
 * single scalebar refName label names, and therefore the span it is fitted to.
 *
 * The unit is the run rather than the displayed region because collapsed
 * introns lay one chromosome out as many adjacent regions, and the label is
 * deduped down to one for the lot. Fitting that one label to the *first*
 * region's width dropped it whenever the exon under the viewport's left edge
 * was narrow, so the chromosome name blinked out every time a region boundary
 * passed the left edge and nothing named the row until the next one arrived.
 *
 * A nameless block (elided, padding) ends a run: what an elided block hides is
 * other chromosomes, so the same name on its far side starts a region the
 * reader needs named again.
 */
interface RefNameRun {
  key: string
  refName: string
  reversed: boolean
  offsetPx: number
  endPx: number
  firstRegionIndex: number
  lastRegionIndex: number
  isLeftEndOfDisplayedRegion: boolean
}

function refNameRuns(blocks: BaseBlock[]) {
  const runs: RefNameRun[] = []
  let current: RefNameRun | undefined
  for (const block of blocks) {
    if (
      block.type !== 'ContentBlock' ||
      block.displayedRegionIndex === undefined
    ) {
      current = undefined
    } else if (
      // orientation is part of a run's identity, not just its refName: one
      // label carries one direction (a `[rev]` marker under mixed orientation
      // has to mean the whole of what it sits on), and two regions of one
      // chromosome laid out in opposite directions are two things to name
      // anyway, however they are marked
      current?.refName === block.refName &&
      current.reversed === !!block.reversed
    ) {
      current.endPx = block.offsetPx + block.widthPx
      current.lastRegionIndex = block.displayedRegionIndex
    } else {
      current = {
        key: block.key,
        refName: block.refName,
        reversed: !!block.reversed,
        offsetPx: block.offsetPx,
        endPx: block.offsetPx + block.widthPx,
        firstRegionIndex: block.displayedRegionIndex,
        lastRegionIndex: block.displayedRegionIndex,
        isLeftEndOfDisplayedRegion: !!block.isLeftEndOfDisplayedRegion,
      }
      runs.push(current)
    }
  }
  return runs
}

/**
 * Index of the run carrying the "sticky" refName label pinned to the left edge:
 * the rightmost run whose left edge has scrolled off the left of the viewport,
 * or the first run when none have.
 */
function stickyRunIndex(runs: RefNameRun[], offsetPx: number) {
  const scrolledOff = runs.findLastIndex(run => run.offsetPx < offsetPx)
  return scrolledOff === -1 ? 0 : scrolledOff
}

/**
 * Whether the displayed regions are laid out left-to-right, right-to-left, or
 * some of each. `horizontallyFlip` reverses the order and flips every region at
 * once, so a flipped row is uniformly `reversed`; `mixed` takes going out of
 * your way, through the scalebar label menu's per-region "Reverse region".
 */
export type RegionsOrientation = 'forward' | 'reversed' | 'mixed'

export function regionsOrientation(
  regions: { reversed?: boolean }[],
): RegionsOrientation {
  const first = !!regions[0]?.reversed
  return regions.every(r => !!r.reversed === first)
    ? first
      ? 'reversed'
      : 'forward'
    : 'mixed'
}

/**
 * What a reversed region's label says after its name. `[rev]` rather than a
 * glyph, and not only because it is the spelling `assembleLocString` already
 * writes into every locstring the search box shows: `measureText`'s width table
 * is indexed by char code and covers ASCII only, so an arrow falls through to
 * the average advance and measures ~6px against a real ~11px. The fit test
 * upstream is whole-or-nothing, and it would go on believing a glyph fits.
 */
const REV_MARKER = ' [rev]'

/** Clearance between the standalone assembly-name chip and a sticky label. */
const PREFIX_GAP = 4

/** Left inset of a non-sticky refName label from its region's left edge. */
const REF_NAME_LABEL_PADDING_PX = 7

export interface ScalebarRefNameLabel {
  key: string
  refName: string
  // first and last displayed region the label names. They differ only where
  // adjacent regions share a refName (collapsed introns), which is exactly
  // where the one deduped label stands for several regions — a menu hung off it
  // has to know that rather than act on an arbitrary member
  displayedRegionIndex: number
  lastDisplayedRegionIndex: number
  // the label pinned to the viewport's left edge, as opposed to one sitting at
  // its own run's left edge. Only this one moves with the scroll, so it is the
  // only one the coordinate numbers cannot dodge in the block frame
  sticky: boolean
  transform: number
  maxWidth: number
  paddingLeft: number
  text: string
}

/**
 * translateX, maxWidth and paddingLeft for one refName label. Sticky labels
 * start at the viewport's left edge; others start at their run's left edge.
 *
 * maxWidth is the width of the whole label box, paddingLeft included, so the
 * text has `maxWidth - paddingLeft` to draw in — that is what both consumers
 * clip to (a border-box max-width on the span, an SVG clip rect from the box's
 * own left edge). The caller decides whether the name it wants to draw fits in
 * that (see refNameLabelWidth); a name is drawn whole or not at all.
 */
function refLabelLayout({
  run,
  offsetPx,
  sticky,
  // left-edge x a sticky label may not start before, so a caption chip drawn
  // there keeps the strip to itself. Zero wherever the caption folds into the
  // label instead (the assembly prefix does)
  minTransform = 0,
}: {
  run: RefNameRun
  offsetPx: number
  sticky: boolean
  minTransform?: number
}) {
  const transform = sticky
    ? Math.max(minTransform, -offsetPx)
    : run.offsetPx - offsetPx - 1
  // block-frame x where the label actually starts. Derived from `transform` (=
  // transform + offsetPx) so the width-to-run-end clip stays in lockstep with
  // where the label is drawn: a sticky label pins to the run's left edge, not
  // the viewport's, whenever the view is left-overscrolled (offsetPx < 0) —
  // reading offsetPx directly there over-counted the available width by
  // |offsetPx|, letting the name bleed past its run's right edge.
  const labelStartPx = transform + offsetPx
  // A non-sticky label's transform anchors at the same x as the region
  // divider drawn just to its left (SVGRegionSeparators, a 3px bar spanning
  // local [0,3] from this same run.offsetPx edge), so paddingLeft must clear
  // that bar plus a few px of breathing room, else the text visually touches
  // the divider. Sticky labels sit at the viewport's own left edge, no divider.
  const paddingLeft = sticky ? 0 : REF_NAME_LABEL_PADDING_PX
  return { transform, maxWidth: run.endPx - labelStartPx - 1, paddingLeft }
}

/**
 * Builds the refName labels drawn along the scalebar as plain data (no JSX): one
 * label per run of same-refName regions (deduped so collapsed introns don't
 * repeat the name) plus a "sticky" label pinned to the left edge naming the
 * refName under the viewport's left border.
 *
 * `caption` is the row-level chip at the viewport's left edge, and it says two
 * things: which assembly this row is (`prefix`, an assembly name, synteny only)
 * and whether the row is flipped. Without it a row of stacked genomes would
 * label some rows with the assembly name and some without, depending only on
 * how wide their leftmost chromosome happens to be.
 *
 * The assembly name alone folds into the sticky label instead — "prefix:refName"
 * — whenever the two would collide at the left edge, and stands alone when the
 * sticky label sits far enough right not to (a view scrolled left of its first
 * region, so the row's data starts mid-viewport) or when there is no sticky
 * label at all.
 *
 * `orientation` decides the ` [rev]` marker, and it is the row's
 * (`displayedRegionsOrientation`) rather than anything read off the blocks —
 * blocks cover the window, and a row is flipped or not whatever part of it you
 * are looking at. The rule is `assembleLocStrings`': say it where it
 * distinguishes, once where it does not.
 *
 * - `reversed`: the whole row is flipped, which is a fact about the row, so the
 *   caption carries it and NO name does. The caption cannot fold in this state
 *   — the sticky label is pushed clear of it instead — because a marker sitting
 *   on a chromosome name is how the mixed case spells a fact about that one
 *   region. `chr1 [rev] | chr2` would otherwise mean both "the row is flipped,
 *   said once" and "chr1 is flipped and chr2 is not", in identical pixels.
 * - `mixed`: only some regions are flipped — reachable through the label menu's
 *   per-region "Reverse region" — so every reversed run is marked and the
 *   forward ones are left alone. Here the marker on a name is the only thing
 *   telling two labels apart.
 * - `forward`: no marker.
 *
 * Saying it once is the point: a flipped whole-genome row would otherwise
 * repeat `[rev]` after all 24 chromosomes to say a single thing about the row.
 *
 * Under `mixed` the marker never costs a name: a suffixed label that fails the
 * fit test falls back to the bare name rather than being dropped. Widening the
 * text moves the region width a name needs from ~30px to ~56px at 11px bold,
 * and a feature meant to surface information should not be deleting chromosome
 * names in the narrow half of that gap.
 */
export function getScalebarRefNameLabels({
  blocks,
  offsetPx,
  prefix,
  orientation = 'forward',
}: {
  blocks: BaseBlock[]
  offsetPx: number
  prefix: string | undefined
  orientation?: RegionsOrientation
}) {
  const hasPrefix = prefix !== undefined && prefix !== ''
  const rowIsReversed = orientation === 'reversed'
  const captionText = rowIsReversed
    ? `${hasPrefix ? prefix : ''}${REV_MARKER}`.trimStart()
    : prefix
  // the caption chip occupies the viewport's left edge, so a sticky label
  // starting inside that span has to yield: absorb the assembly name, or, where
  // the caption carries the row's orientation and so cannot fold, start after
  // it. The gap is part of the span: a sticky label carries no padding of its
  // own, so one starting at exactly the chip's right edge abuts it and the two
  // read as a single word ("volvoxctgA") for the few px of scroll around the
  // threshold
  const captionSpanPx = captionText
    ? refNameLabelWidth(captionText) + PREFIX_GAP
    : 0
  const runs = refNameRuns(blocks)
  const stickyIdx = stickyRunIndex(runs, offsetPx)
  const labels: ScalebarRefNameLabel[] = []
  let stickyHasPrefix = false

  for (const [i, run] of runs.entries()) {
    const sticky = i === stickyIdx
    // A non-sticky run starting left of the viewport is entirely off-screen:
    // the sticky run is by definition the rightmost one starting there, so
    // every earlier run also *ends* left of the viewport. Its label would just
    // repeat the name the sticky label already shows, drawn off-canvas —
    // invisible on screen (overflow:clip) but bleeding into the margin of an
    // SVG export, which has no such clip.
    const runStart = run.offsetPx >= offsetPx && run.isLeftEndOfDisplayedRegion
    if (!(sticky || runStart)) {
      continue
    }
    const layout = refLabelLayout({
      run,
      offsetPx,
      sticky,
      minTransform: rowIsReversed ? captionSpanPx : 0,
    })
    const withPrefix =
      !rowIsReversed && sticky && hasPrefix && layout.transform < captionSpanPx
    const name = withPrefix ? `${prefix}:${run.refName}` : run.refName
    // draw the name whole or not at all: a name clipped mid-glyph reads as a
    // different chromosome ("LG2" cut to "LG"), and measuring it means a short
    // name gets its label in a region a fixed minimum width would have skipped.
    // The marker is the one part that degrades instead of dropping the label
    const text = (
      orientation === 'mixed' && run.reversed
        ? [`${name}${REV_MARKER}`, name]
        : [name]
    ).find(
      candidate =>
        layout.maxWidth >= layout.paddingLeft + refNameLabelWidth(candidate),
    )
    if (text === undefined) {
      continue
    }
    stickyHasPrefix ||= withPrefix
    labels.push({
      key: run.key,
      refName: run.refName,
      displayedRegionIndex: run.firstRegionIndex,
      lastDisplayedRegionIndex: run.lastRegionIndex,
      sticky,
      transform: layout.transform,
      maxWidth: layout.maxWidth,
      paddingLeft: layout.paddingLeft,
      text,
    })
  }
  return {
    labels,
    // the chip to draw at the left edge, or undefined for none. A caption
    // carrying the orientation always draws; one carrying only the assembly
    // name draws when no sticky label folded it in
    caption:
      rowIsReversed || (hasPrefix && !stickyHasPrefix)
        ? captionText
        : undefined,
    captionSpanPx,
  }
}

/**
 * Screen-x span a refName label paints over: its padding and its glyphs, which
 * is the whole of it, since the box shrinks to its text rather than filling the
 * `maxWidth` it was fitted against. Anything drawn under this span is hidden by
 * the label's opaque backing, so the coordinate numbers use it to stay out from
 * under the sticky label the way `runRefNameLabelPx` keeps them out from under
 * the others.
 */
export function refNameLabelSpanPx(label: ScalebarRefNameLabel) {
  return {
    left: label.transform,
    right: label.transform + label.paddingLeft + refNameLabelWidth(label.text),
  }
}

/**
 * Whether a label from getScalebarRefNameLabels is drawn whole within a
 * viewport `widthPx` wide. The labels themselves are only fitted to their own
 * *run of regions*, which routinely runs past the right edge of the view, so
 * one starting a few px before that edge passes the run fit and is then cut by
 * the viewport clip. On screen that reads as a name scrolled partly out of
 * frame, but a static SVG export has no frame to scroll — there a cut "LG2"
 * just names a chromosome that doesn't exist, so the export drops it instead,
 * as it already does for tick numbers at the same edge.
 */
export function refNameLabelFitsInView(
  label: ScalebarRefNameLabel,
  widthPx: number,
) {
  return refNameLabelSpanPx(label).right <= widthPx
}

/**
 * The reorder entries the refName-label menu offers for the region at `idx` of
 * `numRegions`, each already carrying the index it moves to. The "far" moves
 * need a gap of more than one between `idx` and the end — otherwise "Move to
 * far left/right" targets the same index as "Move left/right" and duplicates
 * the entry.
 */
export function regionMoveActions(idx: number, numRegions: number) {
  return [
    { when: idx > 0, label: 'Move left', to: idx - 1 },
    { when: idx < numRegions - 1, label: 'Move right', to: idx + 1 },
    { when: idx > 1, label: 'Move to far left', to: 0 },
    {
      when: idx < numRegions - 2,
      label: 'Move to far right',
      to: numRegions - 1,
    },
  ].flatMap(({ when, label, to }) => (when ? [{ label, to }] : []))
}

/**
 * The region reorderings offered by the refName-label menu, as pure list
 * transforms feeding setDisplayedRegions (which re-clamps bpPerPx/offsetPx for
 * the new region set).
 */
export function withRegionMoved(regions: Region[], from: number, to: number) {
  const out = [...regions]
  const [moved] = out.splice(from, 1)
  out.splice(to, 0, moved!)
  return out
}

export function withRegionRemoved(regions: Region[], index: number) {
  return regions.filter((_, i) => i !== index)
}

export function withRegionReversed(regions: Region[], index: number) {
  return regions.map((region, i) =>
    i === index ? { ...region, reversed: !region.reversed } : region,
  )
}

/**
 * Whether a label occupying [leftPx, leftPx + labelWidth] fits within a block
 * of the given pixel width, used to skip tick labels that would be clipped at a
 * region edge (common with small collapsed-intron regions).
 */
export function labelFitsInBlock(
  leftPx: number,
  labelWidth: number,
  widthPx: number,
) {
  return leftPx >= 0 && leftPx + labelWidth <= widthPx
}

/** Font size of coordinate tick labels on the scalebar and overview scalebar. */
export const TICK_LABEL_FONT_SIZE = 11

/**
 * On-screen width of a coordinate tick label: the text plus 2px of horizontal
 * padding on each side. Single-sourced so the HTML scalebar and the SVG export
 * agree on when a label is too wide to fit inside its block.
 */
export function tickLabelWidth(label: string) {
  return measureText(label, TICK_LABEL_FONT_SIZE) + 4
}

/** Font size of the bold refName label drawn at the left edge of its block, on
 * the scalebar and the overview scalebar alike. */
export const REF_NAME_LABEL_FONT_SIZE = 11

/**
 * measureText's width table is for the regular weight; refName labels are bold,
 * which runs a few percent wider. Under-measuring here would clip the last glyph
 * off a name that was judged to fit, so round up rather than down.
 */
const BOLD_WIDTH_FACTOR = 1.05

/** On-screen width of a bold refName label. */
function refNameLabelWidth(refName: string) {
  return measureText(refName, REF_NAME_LABEL_FONT_SIZE) * BOLD_WIDTH_FACTOR
}

/** Left inset of the overview refName label within its block. */
const REF_NAME_LABEL_INSET_PX = 3

/**
 * Horizontal space the overview refName label occupies at a block's left edge.
 * Overview tick labels use this to avoid drawing underneath the refName, which
 * otherwise collide when zoomed far out (ticks bunch up near the block start).
 */
export function overviewRefNameLabelWidth(refName: string) {
  return (
    REF_NAME_LABEL_INSET_PX +
    refNameLabelWidth(refName) +
    REF_NAME_LABEL_INSET_PX
  )
}

/**
 * Breathing room between the chromosome name and the ideogram to its right, on
 * top of the space the name itself needs.
 */
const CYTOBAND_LABEL_GAP_PX = 9

/**
 * How far right the ideogram starts, i.e. the gutter the chromosome name drawn
 * to its left gets to itself. Shares overviewRefNameLabelWidth with the tick
 * labels that dodge the same name, rather than measuring it again at a font size
 * (12) the label is not actually drawn at (REF_NAME_LABEL_FONT_SIZE).
 */
export function cytobandLabelGutterWidth(refName: string) {
  return overviewRefNameLabelWidth(refName) + CYTOBAND_LABEL_GAP_PX
}

/**
 * Coordinate labels drawn inside one overview-scalebar block: tick text plus its
 * x within the block. Labels that can't be drawn whole between the block's bold
 * refName label and its right edge are dropped by the same
 * tickLabelWidth/labelFitsInBlock test the main scalebar and SVG export use; if
 * too few survive to make a ruler, the block goes unnumbered.
 */
export function makeOverviewTickLabels({
  block,
  bpPerPx,
  refNameLabelPx,
}: {
  block: { start: number; end: number; reversed?: boolean; widthPx: number }
  bpPerPx: number
  refNameLabelPx: number
}) {
  const { start, end, reversed, widthPx } = block
  const labels = makeOverviewTicks(start, end, bpPerPx, reversed).flatMap(
    ({ genomicCoord, offsetPx }) => {
      const label = getTickDisplayStr(genomicCoord, bpPerPx)
      const fits =
        offsetPx >= refNameLabelPx &&
        labelFitsInBlock(offsetPx, tickLabelWidth(label), widthPx)
      return fits ? [{ genomicCoord, offsetPx, label }] : []
    },
  )
  return tickLabelsWorthDrawing(labels.length) ? labels : []
}

/**
 * A maximal run of adjacent staticBlocks that belong to one contiguous
 * displayed region. staticBlocks chop a region into ~800px chunks; merging them
 * back means a coordinate label sitting on an internal chunk boundary is no
 * longer clipped away by both neighbors (only genuine region edges clip).
 */
export interface BlockRun {
  offsetPx: number
  widthPx: number
  start: number
  end: number
  reversed: boolean
  // of the run's first block, so callers can tell whether a refName label is
  // drawn at this run's left edge (see runRefNameLabelPx)
  refName: string
  isLeftEndOfDisplayedRegion: boolean
}

export function groupContiguousBlocks(blocks: BaseBlock[]) {
  const runs: BlockRun[] = []
  let current: BlockRun | undefined
  let currentRegionIndex: number | undefined
  for (const block of blocks) {
    if (block.type === 'ContentBlock') {
      if (
        current !== undefined &&
        currentRegionIndex === block.displayedRegionIndex
      ) {
        current.widthPx += block.widthPx
        current.start = Math.min(current.start, block.start)
        current.end = Math.max(current.end, block.end)
      } else {
        current = {
          offsetPx: block.offsetPx,
          widthPx: block.widthPx,
          start: block.start,
          end: block.end,
          reversed: !!block.reversed,
          refName: block.refName,
          isLeftEndOfDisplayedRegion: !!block.isLeftEndOfDisplayedRegion,
        }
        currentRegionIndex = block.displayedRegionIndex
        runs.push(current)
      }
    } else {
      current = undefined
      currentRegionIndex = undefined
    }
  }
  return runs
}

/**
 * Horizontal space reserved at each run's left edge for the bold refName label
 * drawn there, or 0 for runs that get none. Coordinate labels use this to stay
 * out from under the name, the way the overview scalebar's already do via
 * overviewRefNameLabelWidth: the refName label is opaque and painted after the
 * numbers, so one underneath it isn't merely crowded but invisible — and since
 * both sit in the block frame and scroll together, invisible at every scroll
 * position rather than only while passing behind.
 *
 * Which runs get a label follows getScalebarRefNameLabels: only where a region
 * genuinely begins, and only the first of a run of one refName (collapsed
 * introns make many adjacent regions of the same name). It deliberately drops
 * that function's offsetPx term so the reservation — and with it scalebarLabels
 * — stays stable while scrolling; a run scrolled off the left reserves space
 * that is off-screen anyway. Where the two disagree the reservation is the
 * conservative side: at worst a coordinate is dropped from a region too narrow
 * to have kept MIN_TICK_LABELS_PER_BLOCK of them.
 *
 * `orientation` enters because under `mixed` a reversed run's label carries the
 * ` [rev]` marker and so is wider than its name. Under a uniformly `reversed`
 * row only the sticky label is marked, and that one is dodged on screen instead
 * (`refNameLabelSpanPx`), its x being a function of the scroll rather than of
 * this frame.
 */
export function runRefNameLabelPx(
  runs: BlockRun[],
  orientation: RegionsOrientation = 'forward',
) {
  const isRunStart = showRefNameLabels(runs, run => run.refName)
  return runs.map((run, i) =>
    isRunStart[i] && run.isLeftEndOfDisplayedRegion
      ? REF_NAME_LABEL_PADDING_PX +
        refNameLabelWidth(
          orientation === 'mixed' && run.reversed
            ? `${run.refName}${REV_MARKER}`
            : run.refName,
        )
      : 0,
  )
}

/**
 * makeTicks plus each tick's pixel x within its block, accounting for reversed
 * regions. Single source of the tick→px formula shared by gridlines, the
 * scalebar coordinate labels, and SVG export so their positions can't drift.
 */
export function makeBlockTicks(
  {
    start,
    end,
    reversed = false,
  }: { start: number; end: number; reversed?: boolean },
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  return makeTicks(start, end, bpPerPx, emitMajor, emitMinor).map(tick => ({
    ...tick,
    x: (reversed ? end - tick.base : tick.base - start) / bpPerPx,
  }))
}

/**
 * Generate location objects for a set of parsed locstrings, which includes
 * translating the refNames to assembly-canonical refNames and adding the
 * 'parentRegion'
 *
 * Used by navToLocations and navToLocString
 *
 * @param regions - array of parsed location strings to generate locations for
 * @param assemblyManager - the assembly manager instance
 * @param assemblyName - optional assembly name to use for regions that don't
 * specify one
 * @param grow - optional multiplier to expand regions by (e.g., 0.2 adds 20%
 * padding on each side of the region). Useful for adding visual padding when
 * navigating to a feature
 */
export async function generateLocations({
  regions,
  assemblyManager,
  assemblyName,
  grow,
}: {
  regions: ParsedLocString[]
  assemblyManager: AssemblyManager
  assemblyName?: string
  grow?: number
}) {
  return Promise.all(
    regions.map(async region => {
      const asmName = region.assemblyName || assemblyName
      if (!asmName) {
        throw new Error('no assembly provided')
      }
      const asm = await assemblyManager.waitForAssembly(asmName)
      const { refName } = region
      if (!asm) {
        throw new Error(`assembly ${asmName} not found`)
      }
      const { regions } = asm
      if (!regions) {
        throw new Error(`regions not loaded yet for ${asmName}`)
      }
      const canonicalRefName = asm.getCanonicalRefName(refName)
      if (!canonicalRefName) {
        throw new Error(`Could not find refName ${refName} in ${asm.name}`)
      }
      // scans rather than calling getRegionForRefName: this runs once per typed
      // locstring, not per frame, and the assembly here is duck-typed by several
      // navigation tests that would each have to grow the method
      const parentRegion = regions.find(r => r.refName === canonicalRefName)
      if (!parentRegion) {
        throw new Error(`Could not find refName ${refName} in ${asmName}`)
      }

      const { start, end } = region
      const expanded =
        grow && start !== undefined && end !== undefined
          ? expandRegion(start, end, grow)
          : undefined
      return {
        ...region,
        ...(expanded ? { start: expanded.start, end: expanded.end } : {}),
        assemblyName: asmName,
        parentRegion,
      }
    }),
  )
}

/**
 * Parses locString or space separated set of locStrings into location objects
 * Example inputs:
 * "chr1"
 * "chr1:1-100"
 * "chr1:1..100"
 * "chr1 chr2"
 * "chr1:1-100 chr2:1-100"
 * "chr1 100 200" equivalent to "chr1:100-200"
 * "chr1:34M-35M" equivalent to "chr1:34000000-35000000"
 *
 * Used by navToLocString
 */
export function parseLocStrings(
  input: string,
  assemblyName: string,
  isValidRefName: (str: string, assemblyName: string) => boolean,
) {
  const inputs = input
    .split(/(\s+)/)
    .map(f => f.trim())
    .filter(f => !!f)
  // first try interpreting as a whitespace-separated sequence of
  // multiple locstrings
  try {
    return inputs.map(loc =>
      parseLocString(loc, ref => isValidRefName(ref, assemblyName)),
    )
  } catch (e) {
    // if this fails, try interpreting as a whitespace-separated refname,
    // start, end if start and end are base-pair quantities. The tokens are
    // handed on verbatim rather than as the numbers they parsed to, so the
    // shorthands parseLocString accepts ("34M", "1,000") mean the same thing
    // in this form as in the colon form.
    const [refName, start = '', end = ''] = inputs
    if (
      e instanceof UnknownRefNameError &&
      parseBpString(start) !== undefined &&
      parseBpString(end) !== undefined
    ) {
      return [
        parseLocString(`${refName}:${start}..${end}`, ref =>
          isValidRefName(ref, assemblyName),
        ),
      ]
    }
    throw e
  }
}

export function calculateVisibleLocStrings(contentBlocks: ContentBlock[]) {
  return assembleLocStrings(
    contentBlocks.map(block => ({
      refName: block.refName,
      start: Math.round(block.start),
      end: Math.round(block.end),
      assemblyName: block.assemblyName,
      reversed: block.reversed,
    })),
  )
}
