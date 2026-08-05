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
  view.setDisplayedRegions([
    clampRegion(refName, start - pad, end + pad),
    clampRegion(nextRef, nextPos - pad, nextPos + (end - start) + pad),
  ])
  view.showAllRegions()
  session.notify('Showing mate region', 'info', {
    name: 'Undo',
    onClick: () => {
      view.setDisplayedRegions(previous.displayedRegions)
      view.setNewView(previous.bpPerPx, previous.offsetPx)
    },
  })
}
