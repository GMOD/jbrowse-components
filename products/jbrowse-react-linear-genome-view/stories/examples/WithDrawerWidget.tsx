import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithDrawerWidget = () => {
  const { assembly, tracks } = getVolvoxConfig()
  // Use the 'init' field to automatically show the hierarchical track selector
  // in the drawer when the view loads, similar to ?tracklist=true in URL params
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
    defaultSession: {
      name: 'Drawer Widget Example',
      view: {
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
        init: {
          // @ts-expect-error assembly guaranteed from getVolvoxConfig
          assembly: assembly.name,
          tracklist: true,
        },
      },
    },
  })

  return (
    <div>
      <p>
        This example demonstrates the drawer widget feature showing a
        hierarchical track selector. You can:
      </p>
      <ul>
        <li>
          <strong>Browse tracks</strong> — expand and explore the track
          hierarchy
        </li>
        <li>
          <strong>Resize the drawer</strong> — drag the left edge to adjust
          width
        </li>
        <li>
          <strong>Move the drawer</strong> — click the menu button (⋮) in the
          drawer header to switch between left/right positions
        </li>
        <li>
          <strong>Minimize</strong> — click the minimize button (−) to hide
          the drawer
        </li>
        <li>
          <strong>Close</strong> — click the close button (✕) to close the
          widget
        </li>
      </ul>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithDrawerWidget.tsx">
        Source code
      </a>
    </div>
  )
}
