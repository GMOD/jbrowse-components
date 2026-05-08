/* eslint-disable no-console */

/**
 * Basic Linear Genome View
 *
 * The simplest example showing a genome view with tracks and initial location.
 * Shows how to: set up assembly, load tracks, navigate to a region, monitor changes.
 */

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const OneLinearGenomeView = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    // use 1-based coordinates for locstring
    location: 'ctgA:1105..1221',
    onChange: patch => {
      console.log('patch', patch)
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/OneLinearGenomeView.tsx">
        Source code
      </a>
    </div>
  )
}
