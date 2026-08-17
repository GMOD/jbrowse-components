import {
  clampToContig,
  gatherOverlaps,
  getSession,
  notEmpty,
} from '@jbrowse/core/util'
import { showRegionsWithUndo } from '@jbrowse/plugin-linear-genome-view'

import type { MateFields } from '../shared/mateFeature.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Replace the current view's displayed regions with the read locus and its mate
 * locus, so a single LGV shows both side by side. Each locus is padded by one
 * read-length of context. Inter-chromosomal mates just become a second region on
 * a different refName, which `setDisplayedRegions` handles for free, and
 * `showRegionsWithUndo` owns the framing and the Undo.
 *
 * The two loci are **merged where they touch**, which for an ordinary pair is the
 * normal case rather than an edge one: `setDisplayedRegions` does not merge, so a
 * 300bp insert produced two padded windows overlapping by most of their width —
 * the SAME reads drawn twice, side by side, with a region boundary down the
 * middle of the pair the reader asked to see. Whether that happened was decided
 * by the insert size against the padding, so it hit the commonest case (a proper
 * pair) and not the one this feature is really for (a distant or
 * inter-chromosomal mate), which is why it survived. `gatherOverlaps` merges
 * within a refName and never across one, so two chromosomes stay the two regions
 * the caller wants.
 *
 * Takes the already-normalized `MateFields` rather than the Feature: the caller
 * has to run `getMateFields` anyway to decide whether to offer this at all, and
 * that normalizer owns the "is there a MAPPED mate" rule (the RNEXT/PNEXT type
 * checks plus the mate-unmapped flag, whose fields point at the read's own locus
 * by convention). Re-reading `next_ref`/`next_pos` off the feature here was a
 * second, weaker copy of the same decision.
 */
export function viewMateRegionInCurrentView({
  view,
  mate,
}: {
  view: LinearGenomeViewModel
  mate: MateFields
}) {
  const session = getSession(view)
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName
    ? session.assemblyManager.get(assemblyName)
    : undefined
  if (!assembly) {
    return
  }
  const { refName, start, end, nextRef, nextPos } = mate
  const pad = Math.max(end - start, 100)
  // A locus the contig does not reach comes back undefined rather than inverted
  // (see clampToContig). Keeping the other one is still the more useful half of
  // what was asked for.
  const readLocus = clampToContig(assembly, {
    refName,
    start: start - pad,
    end: end + pad,
  })
  const mateLocus = clampToContig(assembly, {
    refName: nextRef,
    start: nextPos - pad,
    end: nextPos + (end - start) + pad,
  })
  const regions = [readLocus, mateLocus].filter(notEmpty)
  if (regions.length === 0) {
    session.notify(
      `Neither this read nor its mate lands inside a contig of ${assembly.name}`,
      'warning',
    )
    return
  }
  showRegionsWithUndo({
    view,
    regions: gatherOverlaps(regions, 0),
    // Naming the dropped half, because the view alone cannot show it was
    // dropped: one region is also what a proper pair merges to, so "Showing
    // mate region" over a view with no mate in it reads as success. A dropped
    // READ locus needs no such line — what is left IS the mate region.
    message: mateLocus
      ? 'Showing mate region'
      : `Showing this read only — its mate lies past the end of ${nextRef}`,
  })
}
