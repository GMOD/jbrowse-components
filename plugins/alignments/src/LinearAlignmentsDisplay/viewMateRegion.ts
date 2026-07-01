import { getSession } from '@jbrowse/core/util'

import type { Feature, Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Replace the current view's displayed regions with the read locus and its mate
// locus, so a single LGV shows both side by side. Mirrors the "Replace current
// view" path of the collapse-introns feature: it snapshots the prior view and
// offers an Undo. Each locus is padded by one read-length of context and clamped
// to the assembly's region bounds. Inter-chromosomal mates just become a second
// region on a different refName, which setDisplayedRegions handles for free.
export function viewMateRegionInCurrentView({
  view,
  feature,
}: {
  view: LinearGenomeViewModel
  feature: Feature
}) {
  const session = getSession(view)
  const nextRef = feature.get('next_ref')
  const nextPos = feature.get('next_pos')
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName
    ? session.assemblyManager.get(assemblyName)
    : undefined
  if (
    typeof nextRef === 'string' &&
    typeof nextPos === 'number' &&
    assemblyName &&
    assembly
  ) {
    const start = feature.get('start')
    const end = feature.get('end')
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
      clampRegion(feature.get('refName'), start - pad, end + pad),
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
}
