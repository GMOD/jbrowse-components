import { useEffect, useState } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LinearMafDisplayModel } from '../LinearMafDisplay/stateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface SelectionCoords {
  dragStartX: number
  dragEndX: number
}

interface UseSequencesOptions {
  model: LinearMafDisplayModel
  selectionCoords?: SelectionCoords
  showAllLetters: boolean
}

/**
 * React hook to fetch sequences for the given selection coordinates
 * @param options - The options for fetching sequences
 * @returns An object containing the sequence, loading state, and error
 */
export function useSequences({
  model,
  selectionCoords,
  showAllLetters,
}: UseSequencesOptions) {
  const [sequence, setSequence] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // If no selection coordinates, no need to fetch
    if (!selectionCoords) {
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setLoading(true)
        setError(undefined)

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

        const fastaSequence = (await rpcManager.call(
          sessionId,
          'MafGetSequences',
          {
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
          },
        )) as string[]

        const formattedSequence = fastaSequence
          .map((r, idx) => `>${samples![idx]!.label}\n${r}`)
          .join('\n')

        setSequence(formattedSequence)
      } catch (e) {
        console.error(e)
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [model, selectionCoords, showAllLetters])

  return { sequence, loading, error }
}
