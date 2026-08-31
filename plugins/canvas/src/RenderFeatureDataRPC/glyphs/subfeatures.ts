import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import {
  TRANSCRIPT_PADDING_RATIO,
  featureHeightPx,
  isCodingFeature,
} from './glyphUtils.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { IsoformStack } from '../rpcTypes.ts'
import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Is this child of a gene one of the isoforms it is choosing among — i.e. a
// transcript-shaped thing that takes a row of its own — rather than a
// decoration alongside them (an NCBI source record, a `biological_region`)?
//
// Structural first, like findGlyph's own dispatch: a child with subfeatures is
// what makes the gene a Subfeatures container to begin with, and the emitter
// draws it exactly like an `mRNA`. `transcriptTypes` is a seven-entry list that
// does NOT name `lnc_RNA`, `misc_RNA`, `ncRNA` or `pseudogenic_transcript`, all
// of which NCBI hangs off a gene next to its mRNAs, so keying only off it left
// those isoforms out of the ranking entirely — a gene trimmed to 2 drew 7 —
// and vanish under `longestCoding` while the layout reported nothing collapsed.
// The type test stays as the fallback for a childless transcript. Matched
// case-insensitively, like isCDS/isExon and the featureAdmission gate.
function isIsoform(sub: Feature, transcriptTypes: ReadonlySet<string>) {
  return (
    getSubfeatures(sub).length > 0 ||
    transcriptTypes.has(featureType(sub).toLowerCase())
  )
}

function transcriptTypeSet(config: DisplayConfig) {
  return new Set(config.transcriptTypes.map(t => t.toLowerCase()))
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
//
// A feature that IS the CDS falls back to its own span, which is the same
// number and the same rule dedupedSortedCDS gives the translator — so a
// polyprotein is ranked on the protein it really translates to, comparable with
// the summed-CDS length every other isoform is ranked on. Summing its cleavage
// products instead would count a different quantity: they can cover the same
// bases twice (RefSeq annotates enterovirus VP0 beside the 1A and 1B it cleaves
// into) and they stop short of the stop codon.
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
  return sum === 0 && isCDS(feature)
    ? feature.get('end') - feature.get('start')
    : sum
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
// `isCodingFeature` walks the whole subtree, and the ranking (which the cap
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
        coding: isCodingFeature(feature),
      },
    ]),
  )
}

type Scores = ReturnType<typeof scoreIsoforms>

// The gene's isoforms, best first: `longestCoding` takes the head and the fit
// ladder's trim takes the first n, so the two agree at n = 1 by construction.
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

function totalLabelRows(layout: FeatureLayout) {
  return (layout.labelRows ?? 0) + (layout.ownsLabelRow ? 1 : 0)
}

// The best `kept` of a ranked isoform list, and the curated tag that put the
// head of it first — the chip names that tag rather than only saying that
// transcripts are hidden, and `tags[Infinity]` is the annotation that named
// none, which leaves the pick to protein length.
//
// The survivors are a Set, so the caller's filter keeps them in the caller's
// order and a gene under the cap lays out identically with it on and off.
//
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
// `longestCoding` is the only collapse left in the worker. It is the user's own
// pick and it is also the payload gate at whole-chromosome zoom, where shipping
// every isoform of every gene was never measured (ADR-092). Everything else the
// display gives up it gives up on the main thread, where it can see the pack.
function collapseIsoforms({
  isoforms,
  scores,
  config,
}: {
  isoforms: Feature[]
  scores: Scores
  config: DisplayConfig
}) {
  return config.geneGlyphMode === 'longestCoding' && isoforms.length > 1
    ? keepRanked(rankIsoforms(isoforms, scores), 1, scores, config)
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
        jexl: args.jexl,
      })
      cache.set(child, layout)
    }
    return layout
  }
}

// The gene's children as the main-thread trim sees them: drawn order, with the
// rank that decides which ones a smaller `k` keeps. `rank` is deliberately not
// the drawn position — the stack sorts by (canonical, coding) alone while the
// ranking also weighs protein length, so "drop a suffix" would keep a different
// set than the worker's own `longestCoding` does at k = 1.
function buildIsoformStack({
  drawn,
  children,
  isoformSet,
  isoformCount,
  scores,
  boxHeightPx,
  canonicalTag,
  collapsedIsoformCount,
}: {
  drawn: Feature[]
  children: FeatureLayout[]
  isoformSet: ReadonlySet<Feature>
  isoformCount: number
  scores: Scores
  boxHeightPx: number
  canonicalTag: string | undefined
  collapsedIsoformCount: number | undefined
}): IsoformStack {
  const rankById = new Map(
    rankIsoforms(
      drawn.filter(f => isoformSet.has(f)),
      scores,
    ).map((f, i) => [f.id(), i]),
  )
  return {
    isoformCount,
    canonicalTag,
    collapsedIsoformCount,
    boxHeightPx,
    children: drawn.map((child, ordinal) => {
      const layout = children[ordinal]!
      const isoform = isoformSet.has(child)
      return {
        featureId: child.id(),
        ordinal,
        isoform,
        rank: isoform ? rankById.get(child.id())! : Infinity,
        yPx: layout.y,
        heightPx: layout.height,
        labelRows: totalLabelRows(layout),
        startBp: child.get('start'),
        endBp: child.get('end'),
      }
    }),
  }
}

export function layoutSubfeatures(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { geneGlyphMode } = config

  // the gene's own resolved height, used only for the inter-transcript gap below
  // — each stacked child carries whatever height its own glyph resolved
  const heightPx = featureHeightPx(feature, args)

  let subfeatures = [...getSubfeatures(feature)]

  const scores = scoreIsoforms(subfeatures, config)

  // Resolve the isoform list once and reuse it for both the gene-glyph control's
  // visibility (does this gene actually have multiple isoforms to choose among?)
  // and the longestCoding collapse, so the control appears exactly when switching
  // modes would change anything.
  const isoforms = getIsoforms(subfeatures, transcriptTypeSet(config))
  const hasMultipleIsoforms = isoforms.length > 1
  const isoformSet = new Set(isoforms)

  const layoutOf = memoizeChildLayouts(args)

  // Which isoforms survive `longestCoding`, or undefined when none are dropped.
  // Ranked BEFORE the stack sort below, which is in place and over an array
  // `isoforms` can BE — getIsoforms falls back to the raw subfeatures for a
  // gene with no isoform-shaped children. Ranking after it would rank a
  // reordered list, and rankIsoforms breaks a tie by index.
  //
  // An expanded gene draws every isoform whatever the mode says. The badge that
  // offers the way back is the main thread's, off `isoformCount` (see
  // `IsoformStack`).
  const expanded = args.expandedGeneIds?.has(feature.id()) ?? false
  const collapsed = expanded
    ? undefined
    : collapseIsoforms({ isoforms, scores, config })

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
    // longestCoding, which keeps one). The two terms `rankIsoforms` leads with,
    // so a capped gene draws first the transcript the chip credits with picking
    // it. Stable below that, so isoforms tying on both terms keep the order they
    // would have had — and an annotation that tags nothing, which is most of
    // them, sorts exactly as before.
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
    children,
    // the gene's own row has to grow by every label row it contains; the main
    // thread spends them in bodyHeightPx, which is the one place both the fit
    // probe and the committed pack read
    labelRows,
    isoformsCollapsed: collapsed !== undefined,
    canonicalTag: collapsed?.canonicalTag,
    hasMultipleIsoforms,
    isoformStack:
      hasMultipleIsoforms || subfeatures.length > 1
        ? buildIsoformStack({
            drawn: subfeatures,
            children,
            isoformSet,
            isoformCount: isoforms.length,
            scores,
            boxHeightPx: heightPx,
            canonicalTag: collapsed?.canonicalTag,
            collapsedIsoformCount:
              geneGlyphMode === 'longestCoding' && hasMultipleIsoforms
                ? 1
                : undefined,
          })
        : undefined,
  }
}
