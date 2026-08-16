import { useRef, useState } from 'react'

import { invokeIpc } from '../ipc.ts'

import type { AssemblyAdapter } from '@jbrowse/core/util/assemblyConfigUtils'
import type { FileLocation } from '@jbrowse/core/util/types'

// monotonic for the life of the renderer, so two dialogs open in sequence can't
// hand the main process the same handle
let nextJobId = 0

/**
 * Turn a plain FASTA into an `IndexedFastaAdapter` by asking the main process to
 * build the .fai, and give the caller a way out while it runs.
 *
 * The read covers the whole file, and a remote one is downloaded in full first,
 * so this is the one step in the open-genome flow that can hold the dialog for
 * minutes. `cancel` reaches the run itself rather than closing the window over
 * it and leaving the download going with nothing waiting on it.
 *
 * `status` is the caller's busy flag as well as its message: it is set for
 * exactly as long as a run is in flight.
 */
export function useFastaIndexer() {
  const [status, setStatus] = useState('')
  const jobRef = useRef<string | undefined>(undefined)

  async function indexFasta(
    assemblyName: string,
    fastaLocation: FileLocation,
  ): Promise<AssemblyAdapter> {
    // Narrowing, not a case that happens: core hands desktop a localPath (a
    // uri if the user typed a url) because both producers branch on isElectron
    // — LocalFileChooser's picker and fileToLocation's drag-and-drop — so the
    // blob and file-handle members of FileLocation are unreachable here. The
    // union still includes them and the main process can index neither, so say
    // so out loud rather than send it a location it would read as `undefined`.
    if (!('localPath' in fastaLocation) && !('uri' in fastaLocation)) {
      throw new Error(
        `Cannot index a FASTA at this location type: ${fastaLocation.locationType}`,
      )
    }
    const jobId = `fasta-index-${(nextJobId += 1)}`
    jobRef.current = jobId
    setStatus(`Reading ${assemblyName} to build its .fai index`)
    try {
      const faiPath = await invokeIpc('indexFasta', fastaLocation, jobId)
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation,
        faiLocation: {
          localPath: faiPath,
          locationType: 'LocalPathLocation',
        },
      }
    } finally {
      jobRef.current = undefined
      setStatus('')
    }
  }

  function cancel() {
    const jobId = jobRef.current
    if (jobId) {
      jobRef.current = undefined
      void invokeIpc('cancelIndexFasta', jobId)
    }
  }

  return { status, indexFasta, cancel }
}
