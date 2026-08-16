import { getSession } from '@jbrowse/core/util'

import type { MateFields } from '../shared/mateFeature.ts'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Replace the current view's displayed regions with the read locus and its mate
// locus, so a single LGV shows both side by side. Mirrors the "Replace current
// view" path of the collapse-introns feature: it snapshots the prior view and
// offers an Undo. Each locus is padded by one read-length of context and clamped
// to the assembly's region bounds. Inter-chromosomal mates just become a second
// region on a different refName, which setDisplayedRegions handles for free.
//
// Takes the already-normalized `MateFields` rather than the Feature: the caller
// has to run `getMateFields` anyway to decide whether to offer this at all, and
// that normalizer owns the "is there a MAPPED mate" rule (the RNEXT/PNEXT type
// checks plus the mate-unmapped flag, whose fields point at the read's own
// locus by convention). Re-reading `next_ref`/`next_pos` off the feature here
// was a second, weaker copy of the same decision.
/**
 * Collapse the two loci into one where they meet, which for an ordinary pair is
 * the normal case rather than an edge one.
 *
 * `setDisplayedRegions` does not merge, so a 300bp insert produced two padded
 * windows that overlap by most of their width — the SAME reads drawn twice, side
 * by side, with a region boundary down the middle of the pair the reader asked
 * to see. Whether that happens is decided by the insert size against the padding,
 * so it hit the commonest case (a proper pair) and not the one this feature is
 * really for (a distant or inter-chromosomal mate), which is why it survived.
 *
 * Only touching regions on ONE refName merge; two chromosomes stay two regions,
 * which is the split view the caller wants.
 */
function mergeTouchingRegions([a, b]: [Region, Region]): Region[] {
  return a.refName === b.refName && a.start <= b.end && b.start <= a.end
    ? [{ ...a, start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) }]
    : [a, b]
}

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
  if (!assemblyName || !assembly) {
    return
  }
  const { refName, start, end, nextRef, nextPos } = mate
  const pad = Math.max(end - start, 100)
  const clampRegion = (refName: string, s: number, e: number): Region => {
    const canonical = assembly.getCanonicalRefName2(refName)
    const bounds = assembly.regions?.find(r => r.refName === canonical)
    return {
      assemblyName,
      refName: canonical,
      start: Math.max(bounds?.start ?? 0, s),
      end: bounds ? Math.min(bounds.end, e) : e,
    }
  }
  const previous = {
    displayedRegions: view.displayedRegions,
    bpPerPx: view.bpPerPx,
    offsetPx: view.offsetPx,
  }
  view.setDisplayedRegions(
    mergeTouchingRegions([
      clampRegion(refName, start - pad, end + pad),
      clampRegion(nextRef, nextPos - pad, nextPos + (end - start) + pad),
    ]),
  )
  // fit, not showAllRegions: `pad` above is the padding this wants, and
  // showAllRegions would add a second 10% on top of it that nothing asked for.
  view.fitAllRegions()
  session.notify('Showing mate region', 'info', {
    name: 'Undo',
    onClick: () => {
      view.setDisplayedRegions(previous.displayedRegions)
      view.setNewView(previous.bpPerPx, previous.offsetPx)
    },
  })
}
