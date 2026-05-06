// in your code:
// import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithShowTrack = () => {
  const [state] = useState(() => {
    const { assembly, tracks } = getVolvoxConfig()
    const s = createViewState({ assembly, tracks, location: 'ctgA:1105..1221' })
    // full reference: https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-showtrack
    s.session.view.showTrack('volvox-long-reads-sv-bam')
    return s
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithShowTrack.tsx">
        Source code
      </a>
    </div>
  )
}
