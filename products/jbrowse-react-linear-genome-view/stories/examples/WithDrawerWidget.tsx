import { useEffect } from 'react'

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithDrawerWidget = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })

  useEffect(() => {
    // Open a configuration editor widget in the drawer
    // This demonstrates the drawer widget functionality
    const track = state.session.view.tracks[0]
    if (track?.configuration) {
      state.session.editConfiguration(track.configuration)
    }
  }, [state])

  return (
    <div>
      <p>
        This example shows a widget displayed in a drawer panel on the right side
        of the screen. You can:
      </p>
      <ul>
        <li>Resize the drawer by dragging the left edge</li>
        <li>
          Click the menu button (⋮) in the drawer header to switch the drawer
          position (left/right)
        </li>
        <li>
          Click the minimize button (−) to hide the drawer while keeping the
          widget open
        </li>
        <li>Click the close button (✕) to close the widget</li>
      </ul>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithDrawerWidget.tsx">
        Source code
      </a>
    </div>
  )
}
