import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import {
  budgetFeatureHeightPx,
  featureHeightPx,
  hasCodingSubfeature,
} from './glyphUtils.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Expressed as a fraction of heightPx so the entire within-gene layout scales
// linearly — main-thread compact scaling (multiplier × all y values) is exact.
// Exported for `effectiveMaxIsoforms`, which spends the same gap.
export const TRANSCRIPT_PADDING_RATIO = 0.2

// Is this child of a gene one of the isoforms it is choosing among — i.e. a
// transcript-shaped thing that takes a row of its own — rather than a
// decoration alongside them (an NCBI source record, a `biological_region`)?
//
// Structural first, like findGlyph's own dispatch: a child with subfeatures is
// what makes the gene a Subfeatures container to begin with, and the emitter
// draws it exactly like an `mRNA`. `transcriptTypes` is a seven-entry list that
// does NOT name `lnc_RNA`, `misc_RNA`, `ncRNA` or `pseudogenic_transcript`, all
// of which NCBI hangs off a gene next to its mRNAs, so keying only off it let
// those isoforms escape the height cap entirely — a gene capped at 2 drew 7 —
// and vanish under `longestCoding` while the layout reported nothing collapsed.
// The type test stays as the fallback for a childless transcript. Matched
// case-insensitively, like isCDS/isExon and the featureAdmission gate.
function isIsoform(sub: Feature, transcriptTypes: ReadonlySet<string>) {
  return (
    getSubfeatures(sub).length > 0 ||
    transcriptTypes.has(featureType(sub).toLowerCase())
  )
}

// The isoforms a gene is choosing among: its isoform-shaped children when
// present, else the raw subfeatures. Single source so the "Isoforms collapsed"
// notice and the gene-glyph control's visibility can't drift apart.
function getIsoforms(
  subfeatures: Feature[],
  transcriptTypes: ReadonlySet<string>,
) {
  const isoforms = subfeatures.filter(sub => isIsoform(sub, transcriptTypes))
  return isoforms.length > 0 ? isoforms : subfeatures
}

// Total coding bp across a feature's subtree (0 when non-coding). "Longest
// coding" means the longest protein, i.e. summed CDS length — not the widest
// genomic footprint, which an isoform with a large intron could win despite a
// shorter protein. CDS segments are deduped by start-end (matching
// dedupedSortedCDS): duplicated CDS rows are a real GFF3 quirk (e.g. Gencode)
// and, counted twice here, would inflate one isoform's length and win it the
// "longest coding" pick over a genuinely longer protein.
function codingLength(feature: Feature): number {
  const seen = new Set<string>()
  let sum = 0
  const walk = (f: Feature) => {
    for (const sub of getSubfeatures(f)) {
      if (isCDS(sub)) {
        const start = sub.get('start')
        const end = sub.get('end')
        const key = `${start}-${end}`
        if (!seen.has(key)) {
          seen.add(key)
          sum += end - start
        }
      } else {
        walk(sub)
      }
    }
  }
  walk(feature)
  return sum
}

// How highly the annotation itself rates this feature as the gene's
// representative — its position in `canonicalTranscriptTags`, or Infinity for
// one that carries no listed tag. Read out of whichever attribute the config
// names (`tag=RefSeq Select` in NCBI's GFF3, `MANE_Select` / `Ensembl_canonical`
// in Ensembl's); a GFF3 attribute holding a comma list arrives as an array, so
// both shapes match, case-insensitively.
//
// A position rather than a boolean because the default list holds two tags a
// single gene can carry at once: `MANE Plus Clinical` marks an ADDITIONAL
// transcript kept for clinical variants outside the MANE Select one, and it is
// often the longer of the two — so with both flattened to "tagged", the
// coding-length tiebreak below picked between them by a coin flip, and got the
// gene wrong exactly when the curators had said which one was right.
function canonicalRank(feature: Feature, field: string, wanted: string[]) {
  const value = feature.get(field)
  const values = Array.isArray(value)
    ? value.map(v => String(v).toLowerCase())
    : typeof value === 'string'
      ? [value.toLowerCase()]
      : []
  let best = Infinity
  for (const v of values) {
    const rank = wanted.indexOf(v)
    if (rank !== -1 && rank < best) {
      best = rank
    }
  }
  return best
}

interface IsoformScore {
  canonical: number
  coding: boolean
}

// The two terms BOTH orderings below lead with, per child, measured once —
// `hasCodingSubfeature` walks the whole subtree, and the ranking (which the cap
// and `longestCoding` share) and the stack sort each used to walk it again.
//
// Protein length is deliberately not here: only the ranking needs it, and
// `codingLength` walks the subtree a second time. Every gene on screen pays for
// this map on every layout, while the ranking runs only when a gene is actually
// collapsing.
function scoreIsoforms(features: Feature[], config: DisplayConfig) {
  const { canonicalTranscriptField: field, canonicalTranscriptTags } = config
  const wanted = canonicalTranscriptTags.map(t => t.toLowerCase())
  return new Map<string, IsoformScore>(
    features.map(feature => [
      feature.id(),
      {
        canonical: wanted.length
          ? canonicalRank(feature, field, wanted)
          : Infinity,
        coding: hasCodingSubfeature(feature),
      },
    ]),
  )
}

type Scores = ReturnType<typeof scoreIsoforms>

// The gene's isoforms, best first: `longestCoding` takes the head, the height
// cap takes the first n, so the two agree at n = 1 by construction.
//
// A tagged isoform outranks everything, because a curated tag is a better
// answer to "which isoform speaks for this gene" than any measurement of one —
// it is the choice a human made, and for a gene whose longest protein is a
// minor variant it is the only thing that gets that gene right. Then coding
// isoforms above non-coding ones and by protein length; a non-coding one is
// ranked by span, which it is only ever compared on against other non-coding
// ones — so that is also the whole ranking for a gene with no coding isoform at
// all (a lncRNA), and for the annotations (most of them) that tag nothing.
//
// A coding-length tie resolves to the LATER isoform (DPP6 and other fixtures
// depend on it), which a stable sort would break the other way — hence the
// explicit index tiebreak. Sized once per isoform, not inside the comparator,
// which would re-walk each subtree O(n log n) times.
function rankIsoforms(isoforms: Feature[], scores: Scores): Feature[] {
  return isoforms
    .map((feature, index) => {
      const { canonical, coding } = scores.get(feature.id())!
      return {
        feature,
        index,
        canonical,
        coding,
        size: coding
          ? codingLength(feature)
          : feature.get('end') - feature.get('start'),
      }
    })
    .sort(
      (a, b) =>
        a.canonical - b.canonical ||
        Number(b.coding) - Number(a.coding) ||
        b.size - a.size ||
        b.index - a.index,
    )
    .map(s => s.feature)
}

// `heightPx * TRANSCRIPT_PADDING_RATIO` is inexact in binary (24 × 0.2 =
// 4.800000000000001), so a stack that exactly fills its budget must not lose to
// the last bit.
const BUDGET_EPSILON_PX = 1e-9

function totalLabelRows(layout: FeatureLayout) {
  return (layout.labelRows ?? 0) + (layout.ownsLabelRow ? 1 : 0)
}

// How many of `candidates`, in the order given, still fit a lane of
// `budgetRows` isoform-sized rows once the decorations beside them are charged.
//
// Counting isoforms is wrong on two shapes that both take real rows out of the
// lane: a gene hangs decorations next to its isoforms (an NCBI source record, a
// `biological_region`) which the cap deliberately keeps, and an isoform can be
// taller than one row (a polyprotein CDS draws one per cleavage product).
// `effectiveMaxIsoforms` runs on the main thread before the fetch, off config
// and track height alone, so it sees neither — this is the only place the whole
// child list and every child's measured height are visible.
//
// Each child costs its own height plus the gap after it, and each budgeted row
// costs a body plus a gap, so the one gap the last child never spends cancels on
// both sides and the budget is `isoformRowBudget`'s exactly.
//
// `below` label rows are a SECOND budget rather than a term folded into the
// first, because a label row's height is the display mode's label font size and
// only the main thread knows it (see FeatureLayout.labelRowsAbove). Two budgets
// can only under-admit, which is the direction the cap wants (see
// MAX_FEATURE_LABEL_LINES).
//
// The floor is one isoform, like `isoformRowBudget`'s own — so a lone isoform
// taller than the whole lane still overflows, which no arithmetic over a child
// list can fix.
function isoformsWithinBudget({
  candidates,
  decorations,
  budgetRows,
  rowPx,
  subfeatureLabelsBelow,
  layoutOf,
}: {
  candidates: Feature[]
  decorations: Feature[]
  budgetRows: number
  rowPx: number
  subfeatureLabelsBelow: boolean
  layoutOf: (child: Feature) => FeatureLayout
}) {
  const gapPx = rowPx * TRANSCRIPT_PADDING_RATIO
  const budgetPx = budgetRows * (rowPx + gapPx) + BUDGET_EPSILON_PX
  const budgetLabelRows = subfeatureLabelsBelow ? budgetRows : 0
  let spentPx = 0
  let spentLabelRows = 0
  const charge = (child: Feature) => {
    const layout = layoutOf(child)
    spentPx += layout.height + gapPx
    spentLabelRows += totalLabelRows(layout)
  }
  for (const decoration of decorations) {
    charge(decoration)
  }
  let kept = 0
  for (const candidate of candidates) {
    charge(candidate)
    if (kept > 0 && (spentPx > budgetPx || spentLabelRows > budgetLabelRows)) {
      break
    }
    kept++
  }
  return kept
}

// The best `kept` of a ranked isoform list, and the curated tag that put the
// head of it first — the chip names that tag rather than only saying that
// transcripts are hidden, and `tags[Infinity]` is the annotation that named
// none, which leaves the pick to protein length.
//
// The survivors are a Set, so the caller's filter keeps them in the caller's
// order and a gene under the cap lays out identically with it on and off.
function keepRanked(
  ranked: Feature[],
  kept: number,
  scores: Scores,
  config: DisplayConfig,
) {
  return {
    keep: new Set(ranked.slice(0, kept).map(f => f.id())),
    canonicalTag:
      config.canonicalTranscriptTags[scores.get(ranked[0]!.id())!.canonical],
  }
}

// Which isoforms this gene draws, or undefined when it draws all of them.
//
// `longestCoding` is the user's own pick and takes the head of the ranking
// whatever it costs. The height cap is a promise about the lane instead, so it
// measures — but only after the cheap count test, so a gene comfortably under
// the cap never pays for `rankIsoforms`, which walks every isoform's subtree.
// A gene over the count skips straight to the ranking and stops charging at the
// first isoform that does not fit, so the cap still lays out no loser.
function collapseIsoforms({
  isoforms,
  decorations,
  scores,
  config,
  layoutOf,
}: {
  isoforms: Feature[]
  decorations: Feature[]
  scores: Scores
  config: DisplayConfig
  layoutOf: (child: Feature) => FeatureLayout
}) {
  const { geneGlyphMode, maxIsoforms } = config
  if (geneGlyphMode === 'longestCoding') {
    return isoforms.length > 1
      ? keepRanked(rankIsoforms(isoforms, scores), 1, scores, config)
      : undefined
  }
  if (maxIsoforms === undefined) {
    return undefined
  }
  const budget = {
    decorations,
    budgetRows: Math.max(1, maxIsoforms),
    rowPx: budgetFeatureHeightPx(config.featureHeight),
    subfeatureLabelsBelow: config.subfeatureLabels === 'below',
    layoutOf,
  }
  if (
    isoforms.length <= budget.budgetRows &&
    isoformsWithinBudget({ ...budget, candidates: isoforms }) ===
      isoforms.length
  ) {
    return undefined
  }
  const ranked = rankIsoforms(isoforms, scores)
  const kept = isoformsWithinBudget({ ...budget, candidates: ranked })
  return kept < isoforms.length
    ? keepRanked(ranked, kept, scores, config)
    : undefined
}

// Every child laid out at most once, however many times the cap and the stacking
// loop below ask for it. Keyed by object identity rather than `id()`, so a
// duplicated feature id costs a row instead of aliasing two children together.
function memoizeChildLayouts(args: LayoutArgs) {
  const { feature, config } = args
  const cache = new Map<Feature, FeatureLayout>()
  return (child: Feature) => {
    let layout = cache.get(child)
    if (!layout) {
      layout = findGlyph(
        child,
        config,
        false,
      )({
        ...args,
        feature: child,
        parentFeature: feature,
      })
      layout.ownsLabelRow = reservesBelowLabelRow({
        feature: child,
        config,
        glyphType: layout.glyphType,
      })
      cache.set(child, layout)
    }
    return layout
  }
}

export function layoutSubfeatures(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { geneGlyphMode, transcriptTypes } = config

  // the gene's own resolved height, used only for the inter-transcript gap below
  // — each stacked child carries whatever height its own glyph resolved
  const heightPx = featureHeightPx(feature, args)

  let subfeatures = [...getSubfeatures(feature)]

  const transcriptTypeSet = new Set(transcriptTypes.map(t => t.toLowerCase()))
  const scores = scoreIsoforms(subfeatures, config)

  // Resolve the isoform list once and reuse it for both the gene-glyph control's
  // visibility (does this gene actually have multiple isoforms to choose among?)
  // and the longestCoding collapse, so the control appears exactly when switching
  // modes would change anything.
  const isoforms = getIsoforms(subfeatures, transcriptTypeSet)
  const hasMultipleIsoforms = isoforms.length > 1
  const isoformSet = new Set(isoforms)

  const layoutOf = memoizeChildLayouts(args)

  // Which isoforms survive, or undefined when none are being dropped.
  //
  // Ranked BEFORE the stack sort below, which is in place and over an array
  // `isoforms` can BE — getIsoforms falls back to the raw subfeatures for a
  // gene with no isoform-shaped children. Ranking after it would rank a
  // reordered list, and rankIsoforms breaks a tie by index, so the cap at n = 1
  // would have kept a different isoform than the longestCoding collapse does.
  const collapsed = collapseIsoforms({
    isoforms,
    decorations: subfeatures.filter(sub => !isoformSet.has(sub)),
    scores,
    config,
    layoutOf,
  })

  // Drop the isoforms that lost, leaving the decorations alongside them alone —
  // an NCBI source record, a `biological_region`. `longestCoding` used to
  // replace the child list with the isoform list outright, so those went with
  // them, and for a gene with a single isoform beside one it did that while
  // reporting nothing collapsed at all.
  if (collapsed) {
    subfeatures = subfeatures.filter(
      f => !isoformSet.has(f) || collapsed.keep.has(f.id()),
    )
  }

  if (geneGlyphMode !== 'longestCoding') {
    // Stack the tagged isoform on top, then the coding ones (pointless for
    // longestCoding, which keeps one). Same two terms `rankIsoforms` leads
    // with, so the transcript a capped gene keeps first is also the one it
    // draws first, and the gene reads top-down. Stable, so the survivors of the
    // cap keep the order they would have had — and an annotation that tags
    // nothing, which is most of them, sorts exactly as before.
    subfeatures.sort((a, b) => {
      const x = scores.get(a.id())!
      const y = scores.get(b.id())!
      return x.canonical - y.canonical || Number(y.coding) - Number(x.coding)
    })
  }

  const children: FeatureLayout[] = []
  let currentYPx = 0
  // `below` label rows placed so far. They are counted, never added to
  // `currentYPx`: their height is the display mode's label font size and only
  // the main thread knows it (see reservesBelowLabelRow). Every Y this loop
  // writes therefore stays proportional to `heightPx`, which is what makes the
  // main thread's uniform compact scale exact — the property
  // TRANSCRIPT_PADDING_RATIO exists to preserve, and the one an absolute
  // LABEL_FONT_SIZE in this running offset used to break.
  let labelRows = 0

  for (const [i, child] of subfeatures.entries()) {
    const childLayout = layoutOf(child)

    childLayout.y = currentYPx
    childLayout.labelRowsAbove = labelRows

    children.push(childLayout)

    currentYPx += childLayout.height
    // rows the child spends INSIDE itself (a polyprotein CDS labels each of its
    // cleavage products), which sit between this child's top and the next one's
    // and so are above every sibling that follows, plus the one it reserves
    // under its own body
    labelRows += totalLabelRows(childLayout)
    if (i < subfeatures.length - 1) {
      currentYPx += heightPx * TRANSCRIPT_PADDING_RATIO
    }
  }

  const totalHeightPx = currentYPx > 0 ? currentYPx : heightPx

  return {
    feature,
    glyphType: 'Subfeatures',
    y: 0,
    height: totalHeightPx,
    totalLayoutHeight: totalHeightPx,
    children,
    // the gene's own row has to grow by every label row it contains; the main
    // thread spends them in bodyHeightPx, which is the one place both the fit
    // probe and the committed pack read
    labelRows,
    isoformsCollapsed: collapsed !== undefined,
    canonicalTag: collapsed?.canonicalTag,
    hasMultipleIsoforms,
  }
}
