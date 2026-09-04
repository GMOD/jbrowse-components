import { featurizeSAEntries, getClip, splitSA } from '@jbrowse/cigar-utils'
import {
  clampToListedContig,
  gatherOverlaps,
  getSession,
  notEmpty,
  pluralize,
} from '@jbrowse/core/util'
import { showRegionsWithUndo } from '@jbrowse/plugin-linear-genome-view'

import { extractFeatureTagValue } from '../shared/extractFeatureTagValue.ts'
import { getStrand } from '../shared/util.ts'

import type { LinkedReadsMode } from './constants.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface AlignedSegment {
  refName: string
  start: number
  end: number
  clip: number
}

/**
 * Every locus a split read aligns to — the record's own plus each one its SA
 * tag names — ordered along the read by clip-at-start, so a fusion lists its
 * donor before its acceptor. Empty for a read with no SA tag, so a caller can
 * gate on the length. A truncated SA record parses to an empty span and is
 * dropped rather than sent to the view as a region.
 */
export function splitAlignmentSegments(feature: Feature): AlignedSegment[] {
  const records = splitSA(extractFeatureTagValue(feature, 'SA'))
  if (records.length === 0) {
    return []
  }
  const cigar = (feature.get('CIGAR') as string | undefined) ?? ''
  const own: AlignedSegment = {
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    clip: getClip(cigar, getStrand(feature)),
  }
  const others = featurizeSAEntries(records, feature.id(), undefined, undefined)
    .filter(s => Number.isFinite(s.start) && s.end > s.start)
    .map(s => ({
      refName: s.refName,
      start: s.start,
      end: s.end,
      clip: s.clipLengthAtStartOfRead,
    }))
  return [own, ...others].sort((a, b) => a.clip - b.clip)
}

interface LinkedReadsDisplay {
  linkedReads: LinkedReadsMode
  setLinkedReads: (mode: LinkedReadsMode) => void
}

/**
 * Replace the view's displayed regions with one window per segment of a split
 * read, in read order, so the whole molecule is on screen side by side. Each
 * window is padded by its segment's own length and windows that touch on one
 * refName merge, the same framing `viewMateRegionInCurrentView` gives a mate.
 *
 * The view is switched into chain layout when it isn't already, since the point
 * of putting the segments side by side is the connector between them, and Undo
 * puts the layout back with the regions.
 */
export function viewSplitAlignmentRegionsInCurrentView({
  view,
  display,
  segments,
}: {
  view: LinearGenomeViewModel
  display: LinkedReadsDisplay
  segments: AlignedSegment[]
}) {
  const session = getSession(view)
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName
    ? session.assemblyManager.get(assemblyName)
    : undefined
  if (!assembly) {
    return
  }
  const loci = segments.map(({ refName, start, end }) => {
    const pad = Math.max(end - start, 100)
    return clampToListedContig(assembly, {
      refName,
      start: start - pad,
      end: end + pad,
    })
  })
  const regions = loci.map(locus => locus.region).filter(notEmpty)
  if (regions.length === 0) {
    session.notify(
      `None of this read's ${segments.length} aligned segments lands inside a contig of ${assembly.name}`,
      'warning',
    )
    return
  }
  const dropped = loci.filter(locus => locus.region === undefined)
  const pastEnd = dropped.filter(locus => locus.onAssembly)
  const unlisted = dropped.filter(locus => !locus.onAssembly)
  const wasLinked = display.linkedReads !== 'off'
  if (!wasLinked) {
    display.setLinkedReads('normal')
  }
  // Counted after the merge, which is what the view ends up showing: two
  // segments landing close together on one contig are one window there, and
  // announcing the pre-merge number named a region a reader could not find.
  const merged = gatherOverlaps(regions, 0)
  const shown = `Showing ${merged.length} aligned ${pluralize(merged.length, 'segment')} of this read`
  const leftOut = [
    pastEnd.length
      ? `${pastEnd.length} ${pluralize(pastEnd.length, 'segment')} past the end of ${[...new Set(pastEnd.map(l => l.refName))].join(', ')}`
      : undefined,
    unlisted.length
      ? `${unlisted.length} ${pluralize(unlisted.length, 'segment')} on ${[...new Set(unlisted.map(l => l.refName))].join(', ')}, which ${assembly.name} does not have`
      : undefined,
  ].filter(notEmpty)
  showRegionsWithUndo({
    view,
    regions: merged,
    message: leftOut.length
      ? `${shown} — left out ${leftOut.join(' and ')}`
      : shown,
    alsoUndo: wasLinked
      ? undefined
      : () => {
          display.setLinkedReads('off')
        },
  })
}
