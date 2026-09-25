import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { diagonalizeRegions } from '@jbrowse/core/util/diagonalizeRegions'
import { when } from 'mobx'

import { mirrorRegionsForCircle } from './mirrorRegions.ts'

import type { CircularViewModel } from '../model.ts'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'
import type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from '@jbrowse/synteny-core'

/**
 * Reorder the second genome's chromosomes so the ribbons between the two arcs
 * read as a band, in the shape both the menu dialog and the init autorun can
 * call. The caller gates the figure and the loading UI; this just runs.
 *
 * Unlike the synteny row and the dotplot, the circle already holds every
 * alignment on the main thread, so this waits for the ribbon displays' own
 * fetch and orders from that rather than reading the file again in a worker.
 * What the circle adds is the mirror, applied on the way out and undone on the
 * way in, which is also what makes the pass idempotent. ADR-121.
 */
export async function runCircularDiagonalize(
  model: CircularViewModel,
  { signal, statusCallback }: DiagonalizeRunOpts = {},
): Promise<DiagonalizeStats | undefined> {
  const displays = model.chordSyntenyDisplays
  const [referenceAssembly, currentAssembly] = model.assemblyNames
  if (
    !displays.length ||
    model.assemblyNames.length !== 2 ||
    !referenceAssembly ||
    !currentAssembly
  ) {
    return undefined
  }
  statusCallback?.('Loading features')
  await when(() => displays.every(d => d.loaded || !!d.displayError), {
    signal,
  })
  const failed = displays.find(d => d.displayError)
  if (failed) {
    throw failed.displayError
  }
  checkAbortSignal(signal)

  const alignments: AlignmentData[] = []
  for (const display of displays) {
    for (const a of display.alignmentsBetween(
      referenceAssembly,
      currentAssembly,
    )) {
      alignments.push(a)
    }
  }
  if (!alignments.length) {
    return undefined
  }
  const referenceRegions = model.displayedRegions.filter(
    r => r.assemblyName === referenceAssembly,
  )
  const result = await diagonalizeRegions(
    alignments,
    referenceRegions,
    mirrorRegionsForCircle(
      model.displayedRegions.filter(r => r.assemblyName === currentAssembly),
    ),
    { signal, statusCallback },
  )
  model.setDisplayedRegions([
    ...referenceRegions,
    ...mirrorRegionsForCircle(result.newRegions),
  ])
  return {
    totalReordered: result.stats.regionsReordered,
    totalReversed: result.stats.regionsReversed,
  }
}
