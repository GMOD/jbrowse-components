import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LinearMafDisplayModel } from '../LinearMafDisplay/stateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface SelectionCoords {
  dragStartX: number
  dragEndX: number
}

/**
 * Fetch sequences for the given selection coordinates
 * @param model - The LinearMafDisplayModel
 * @param selectionCoords - The selection coordinates (dragStartX and dragEndX)
 * @param showAllLetters - Whether to show all letters or just the differences
 * @returns Promise that resolves to the FASTA sequence
 */
export async function fetchSequences({
  model,
  selectionCoords,
  showAllLetters,
}: {
  model: LinearMafDisplayModel
  selectionCoords: SelectionCoords
  showAllLetters: boolean
}) {
  const { samples, adapterConfig } = model
  const { rpcManager } = getSession(model)
  const sessionId = getRpcSessionId(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { refName, assemblyName } = view.displayedRegions[0]!
  const { dragStartX, dragEndX } = selectionCoords
  const [s, e] = [
    Math.min(dragStartX, dragEndX),
    Math.max(dragStartX, dragEndX),
  ]

  const fastaSequence = (await rpcManager.call(sessionId, 'MafGetSequences', {
    sessionId,
    adapterConfig,
    samples,
    showAllLetters,
    regions: [
      {
        refName,
        start: view.pxToBp(s).coord - 1,
        end: view.pxToBp(e).coord,
        assemblyName,
      },
    ],
  })) as string[]

  return fastaSequence
    .map((r, idx) => `>${samples![idx]!.label}\n${r}`)
    .join('\n')
}
