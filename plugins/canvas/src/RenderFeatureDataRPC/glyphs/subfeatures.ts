import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import { featureHeightPx, hasCodingSubfeature } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Expressed as a fraction of heightPx so the entire within-gene layout scales
// linearly — main-thread compact scaling (multiplier × all y values) is exact.
// Exported for `effectiveMaxIsoforms`, which spends the same gap.
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

// The gene's isoforms, best first: `longestCoding` takes the head, the height
// cap takes the first n, so the two agree at n = 1 by construction.
//
// A coding-length tie resolves to the LATER isoform (DPP6 and other fixtures
// depend on it), which a stable sort would break the other way — hence the
// explicit index tiebreak. Sized once per isoform, not inside the comparator,
// which would re-walk each subtree O(n log n) times.
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
    // non-coding isoforms of a coding gene rank last, among themselves by span
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

// The isoforms to keep under a height cap, or undefined when the gene fits.
// The survivors keep the caller's order, so a gene under the cap lays out
// identically with it on and off.
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
    // …then drop the isoforms past the cap, leaving non-transcript children
    // (an NCBI source record, a `biological_region`) alone.
    const keep = isoformsWithinCap(isoforms, maxIsoforms)
    if (keep) {
      const isoformIds = new Set(isoforms.map(f => f.id()))
      subfeatures = subfeatures.filter(
        f => !isoformIds.has(f.id()) || keep.has(f.id()),
      )
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
