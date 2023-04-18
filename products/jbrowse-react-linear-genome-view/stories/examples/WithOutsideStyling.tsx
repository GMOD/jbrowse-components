import React from 'react'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const WithOutsideStyling = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })

  return (
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      <p>
        This parent container has textAlign:&apos;center&apos; and a monospace
        font, but these attributes are not affecting the internal LGV
      </p>
      <p>
        The react component takes measures to avoid being affected by styles
        outside of it on the page. In this case, a font and a text align, which
        without measures could affect the jbrowse-react-linear-genome-view
        component, is fine here.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithOutsideStyling.tsx">
        Source code
      </a>
    </div>
  )
}
