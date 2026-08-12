import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithDrawerWidget() {
  const [state] = useState(() => {
    const s = createViewState({
      assembly: {
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      },
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'volvox_gff3',
          name: 'Volvox genes',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
          },
        },
      ],
      // the height the view is clamped to *while a drawer is open*, so the
      // drawer has a definite scroll region. '100vh' is the default and is
      // spelled out here only because this is the page about the drawer — any
      // CSS height works ('600px', '80%')
      drawerViewHeight: '100vh',
      defaultSession: {
        name: 'Drawer Widget Example',
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1105..1221',
            tracks: ['volvox_gff3'],
          },
        },
      },
    })
    // open a widget in the drawer on first paint. Widgets live on the session
    // (addWidget/showWidget) — activateTrackSelector opens the hierarchical
    // track selector; clicking a feature likewise opens its details widget.
    s.session.view.activateTrackSelector()
    return s
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
