import { applyLabelDimensions } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import { hasCodingSubfeature } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Expressed as a fraction of heightPx so the entire within-gene layout scales
// linearly — main-thread compact scaling (multiplier × all y values) is exact.
const TRANSCRIPT_PADDING_RATIO = 0.2

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

  const codingCandidates = isoforms.filter(hasCodingSubfeature)
  // Rank coding isoforms by protein length; with no coding isoform at all, fall
  // back to the widest genomic span.
  const [candidates, size] =
    codingCandidates.length > 0
      ? ([codingCandidates, codingLength] as const)
      : ([isoforms, (f: Feature) => f.get('end') - f.get('start')] as const)

  const longest = candidates.reduce((a, b) => (size(a) > size(b) ? a : b))
  return { result: [longest], collapsed: true }
}

export function layoutSubfeatures(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { geneGlyphMode, transcriptTypes, subfeatureLabels } = config

  const heightPx = config.featureHeight

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
  }

  const children: FeatureLayout[] = []
  let currentYPx = 0

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

    applyLabelDimensions(childLayout, {
      feature: child,
      config,
      isTranscriptChild: isChildTranscript,
    })

    childLayout.y = currentYPx

    children.push(childLayout)

    const useExtraHeightForLabels =
      subfeatureLabels === 'below' && isChildTranscript
    const heightForStacking = useExtraHeightForLabels
      ? childLayout.totalLayoutHeight
      : childLayout.height
    currentYPx += heightForStacking
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
    isoformsCollapsed,
    hasMultipleIsoforms,
  }
}
