import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import { featureHeightPx, hasCodingSubfeature } from './glyphUtils.ts'

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
  size: number
}

// Everything the two orderings below ask about a gene's children, measured
// once. `hasCodingSubfeature` and `codingLength` each walk the whole subtree,
// and the ranking (which the cap and `longestCoding` share) and the stack sort
// would otherwise each measure the same gene again.
function scoreIsoforms(features: Feature[], config: DisplayConfig) {
  const { canonicalTranscriptField: field, canonicalTranscriptTags } = config
  const wanted = canonicalTranscriptTags.map(t => t.toLowerCase())
  return new Map<string, IsoformScore>(
    features.map(feature => {
      const coding = hasCodingSubfeature(feature)
      return [
        feature.id(),
        {
          canonical: wanted.length
            ? canonicalRank(feature, field, wanted)
            : Infinity,
          coding,
          size: coding
            ? codingLength(feature)
            : feature.get('end') - feature.get('start'),
        },
      ]
    }),
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
// explicit index tiebreak.
function rankIsoforms(isoforms: Feature[], scores: Scores): Feature[] {
  return isoforms
    .map((feature, index) => ({ feature, index, ...scores.get(feature.id())! }))
    .sort(
      (a, b) =>
        a.canonical - b.canonical ||
        Number(b.coding) - Number(a.coding) ||
        b.size - a.size ||
        b.index - a.index,
    )
    .map(s => s.feature)
}

// The isoforms to keep under a height cap, or undefined when the gene fits.
// The survivors keep the caller's order, so a gene under the cap lays out
// identically with it on and off.
function isoformsWithinCap(
  isoforms: Feature[],
  maxIsoforms: number | undefined,
  scores: Scores,
) {
  return maxIsoforms !== undefined && isoforms.length > maxIsoforms
    ? new Set(
        rankIsoforms(isoforms, scores)
          .slice(0, Math.max(1, maxIsoforms))
          .map(f => f.id()),
      )
    : undefined
}

export function layoutSubfeatures(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { geneGlyphMode, maxIsoforms, transcriptTypes } = config

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

  let isoformsCollapsed = false
  if (geneGlyphMode === 'longestCoding') {
    isoformsCollapsed = hasMultipleIsoforms
    subfeatures = isoformsCollapsed
      ? [rankIsoforms(isoforms, scores)[0]!]
      : isoforms
  } else {
    // Drop the isoforms past the cap, leaving the decorations alongside them (an
    // NCBI source record, a `biological_region`) alone.
    //
    // Before the sort below, which is in place and over an array `isoforms` can
    // BE — getIsoforms falls back to the raw subfeatures for a gene with no
    // isoform-shaped children. Ranking after it would rank a reordered list, and
    // rankIsoforms breaks a tie by index, so the cap at n = 1 would have kept a
    // different isoform than the longestCoding collapse does.
    const keep = isoformsWithinCap(isoforms, maxIsoforms, scores)
    if (keep) {
      const isoformIds = new Set(isoforms.map(f => f.id()))
      subfeatures = subfeatures.filter(
        f => !isoformIds.has(f.id()) || keep.has(f.id()),
      )
      isoformsCollapsed = true
    }
    // Stack the tagged isoform on top, then the coding ones (skipped for
    // longestCoding, which collapses to a single feature). Same two terms
    // `rankIsoforms` leads with, so the transcript a capped gene keeps first is
    // also the one it draws first, and the gene reads top-down. Stable, so the
    // survivors of the cap keep the order they would have had — and an
    // annotation that tags nothing, which is most of them, sorts exactly as
    // before.
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
    const childLayout = findGlyph(
      child,
      config,
      false,
    )({
      ...args,
      feature: child,
      parentFeature: feature,
    })

    childLayout.y = currentYPx
    childLayout.labelRowsAbove = labelRows

    children.push(childLayout)

    currentYPx += childLayout.height
    // rows the child spends INSIDE itself (a polyprotein CDS labels each of its
    // cleavage products), which sit between this child's top and the next one's
    // and so are above every sibling that follows
    labelRows += childLayout.labelRows ?? 0
    if (
      reservesBelowLabelRow({
        feature: child,
        config,
        glyphType: childLayout.glyphType,
      })
    ) {
      childLayout.ownsLabelRow = true
      labelRows++
    }
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
    isoformsCollapsed,
    hasMultipleIsoforms,
  }
}
