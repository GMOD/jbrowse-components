import { isSessionModelWithWidgets } from '@jbrowse/core/util'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type { Sample } from './types.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Open the MAF sequence widget for the genomic range under a drag selection.
 * Resolves refName/assemblyName from `view.pxToBp` at the selection's start
 * pixel, so it picks the right region under the cursor on multi-region views
 * (drag selections crossing region boundaries clip to the start-pixel region).
 */
export function openSubsequenceWidget(
  session: AbstractSessionModel,
  model: LinearMafDisplayModel,
  view: LinearGenomeViewModel,
  startPx: number,
  endPx: number,
  samples: Sample[],
) {
  if (!isSessionModelWithWidgets(session) || samples.length === 0) {
    return
  }
  const sBp = view.pxToBp(Math.min(startPx, endPx))
  const eBp = view.pxToBp(Math.max(startPx, endPx))
  const widget = session.addWidget('MafSequenceWidget', 'mafSequence', {
    adapterConfig: model.adapterConfig,
    samples,
    regions: [
      {
        refName: sBp.refName,
        start: sBp.coord - 1,
        end: eBp.coord,
        assemblyName: sBp.assemblyName,
      },
    ],
    connectedViewId: view.id,
  })
  session.showWidget(widget)
}
