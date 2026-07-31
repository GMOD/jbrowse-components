import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface SampleNavigationTarget {
  assemblyName: string
  chr: string
  start: number
  end: number
  sampleLabel: string
}

/** `chr:start-end`, 1-based inclusive, from the half-open span. */
export function navigationLocString({
  chr,
  start,
  end,
}: SampleNavigationTarget) {
  return `${chr}:${start + 1}-${end}`
}

/**
 * Open the aligned sample's own genome at the locus its MAF row covers.
 *
 * The view id is keyed on the display and the sample, so repeatedly following
 * the same species' rows re-navigates one view instead of stacking new ones.
 * A brand-new view launches declaratively via `init` (spinner while the
 * assembly loads, then self-navigation) rather than being navigated
 * imperatively — same reasoning as the spreadsheet view's location links.
 */
export async function openSampleInNewView(
  session: AbstractSessionModel,
  displayId: string,
  target: SampleNavigationTarget,
) {
  const viewId = `${displayId}_${target.assemblyName}`
  const locString = navigationLocString(target)
  const view = session.views.find(v => v.id === viewId) as
    | LinearGenomeViewModel
    | undefined
  if (view) {
    await view.navToLocString(locString, target.assemblyName)
  } else {
    session.addView('LinearGenomeView', {
      id: viewId,
      init: { assembly: target.assemblyName, loc: locString },
    })
  }
}
