import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import { featureHeightPx, hasCodingSubfeature } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Expressed as a fraction of heightPx so the entire within-gene layout scales
// linearly — main-thread compact scaling (multiplier × all y values) is exact.
//
// Exported for `effectiveMaxIsoforms`, which converts a track height into a
// transcript count and so has to spend the same gap this loop does.
export const TRANSCRIPT_PADDING_RATIO = 0.2

// The isoforms a gene is choosing among: its real transcript children when
// present, else the raw subfeatures. Single source so the "Isoforms collapsed"
// notice and the gene-glyph control's visibility can't drift apart. Matched
// case-insensitively, like isCDS/isExon and the featureAdmission gate — real
// GFFs vary in casing and every type test must agree.
function getIsoforms(
  subfeatures: Feature[],
  transcriptTypes: ReadonlySet<string>,
) {
  const transcripts = subfeatures.filter(sub =>
    transcriptTypes.has(featureType(sub).toLowerCase()),
  )
  return transcripts.length > 0 ? transcripts : subfeatures
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

// The gene's isoforms, best first — which is the one ranking this file has, used
// by `longestCoding` (its head) and by the height cap (its first n). Sharing it
// is what makes the cap an extension of the collapse rather than a second,
// differently-argued opinion about which isoform speaks for the gene: taken at
// n = 1 the two agree by construction.
//
// Coding isoforms outrank non-coding ones and are ranked by protein length, not
// by genomic footprint — an isoform with a large intron could win the latter
// despite a shorter protein. With no coding isoform at all the whole list falls
// back to the widest span, which is the branch a lncRNA gene takes.
//
// `>` not `>=`: an exact coding-length tie resolves to the LATER isoform, which
// several fixtures (DPP6) depend on. A stable sort keeps the earlier one on a
// tie, so the comparator has to break it the other way explicitly.
//
// Sized once per isoform rather than inside the comparator, which would re-walk
// each isoform's whole subtree O(n log n) times.
function rankIsoforms(isoforms: Feature[]): Feature[] {
  const codingCandidates = isoforms.filter(hasCodingSubfeature)
  const anyCoding = codingCandidates.length > 0
  const size = anyCoding
    ? codingLength
    : (f: Feature) => f.get('end') - f.get('start')
  const sized = isoforms.map((feature, index) => ({
    feature,
    index,
    coding: anyCoding && hasCodingSubfeature(feature),
    // a non-coding isoform in a gene that has coding ones is ranked last, and
    // among themselves by span rather than by a coding length that is 0 for all
    // of them
    size:
      anyCoding && !hasCodingSubfeature(feature)
        ? feature.get('end') - feature.get('start')
        : size(feature),
  }))
  return sized
    .sort(
      (a, b) =>
        Number(b.coding) - Number(a.coding) ||
        b.size - a.size ||
        b.index - a.index,
    )
    .map(s => s.feature)
}

// Returns the single longest coding transcript, plus whether an actual choice
// among multiple isoforms was collapsed (drives the "Isoforms collapsed" notice).
// Takes the pre-resolved isoform list so getIsoforms runs once per gene.
function longestCodingTranscript(isoforms: Feature[]): {
  result: Feature[]
  collapsed: boolean
} {
  if (isoforms.length <= 1) {
    return { result: isoforms, collapsed: false }
  }
  return { result: [rankIsoforms(isoforms)[0]!], collapsed: true }
}

// The isoforms to KEEP under a height cap, as a set of ids, or undefined when
// the gene already fits.
//
// It keeps the top `maxIsoforms` of the ranking above and then draws them in
// whatever order the caller had them in — the cap decides WHICH isoforms are
// dropped and changes nothing about the ones that stay, so a gene that fits is
// laid out identically with the cap on and off. (Reordering the survivors by
// rank was the obvious alternative and would have moved every gene track figure
// in the repo for genes that were never capped.)
function isoformsWithinCap(
  isoforms: Feature[],
  maxIsoforms: number | undefined,
) {
  return maxIsoforms !== undefined && isoforms.length > maxIsoforms
    ? new Set(
        rankIsoforms(isoforms)
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

  // Resolve the isoform list once and reuse it for both the gene-glyph control's
  // visibility (does this gene actually have multiple isoforms to choose among?)
  // and the longestCoding collapse, so the control appears exactly when switching
  // modes would change anything.
  const isoforms = getIsoforms(subfeatures, transcriptTypeSet)
  const hasMultipleIsoforms = isoforms.length > 1

  let isoformsCollapsed = false
  if (geneGlyphMode === 'longestCoding') {
    const collapsed = longestCodingTranscript(isoforms)
    subfeatures = collapsed.result
    isoformsCollapsed = collapsed.collapsed
  } else {
    // Sort coding transcripts first so they render on top in stacked layout.
    // Skipped for longestCoding which collapses to a single feature.
    const codingStatus = new Map(
      subfeatures.map(f => [f.id(), hasCodingSubfeature(f)]),
    )
    subfeatures.sort((a, b) => {
      const aHasCDS = codingStatus.get(a.id()) ? 1 : 0
      const bHasCDS = codingStatus.get(b.id()) ? 1 : 0
      return bHasCDS - aHasCDS
    })
    // …then drop the isoforms past the caller's cap. Applied AFTER the sort so
    // the survivors keep the order they would have had, and only to features
    // `getIsoforms` counted as isoforms — a gene's non-transcript children
    // (an NCBI source record, a `biological_region`) are not what the cap is
    // about and are left alone.
    const keep = isoformsWithinCap(isoforms, maxIsoforms)
    if (keep) {
      const isoformIds = new Set(isoforms.map(f => f.id()))
      subfeatures = subfeatures.filter(
        f => !isoformIds.has(f.id()) || keep.has(f.id()),
      )
      // The same flag `longestCoding` sets, because it means the same thing to
      // every consumer: isoforms are hidden, so the gene's own label and hit box
      // anchor to the rendered extent rather than to the full gene span
      // (processFeatureRecord), and the display shows its "some isoforms are
      // hidden" control.
      isoformsCollapsed = true
    }
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
    const childType = featureType(child)
    const isChildTranscript = transcriptTypeSet.has(childType.toLowerCase())
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
        isTranscriptChild: isChildTranscript,
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
