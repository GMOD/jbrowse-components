import { useMemo, useState } from 'react'

import {
  DisplayChromeOverlayProvider,
  plainChromeOverlays,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Palette from '../browser/Palette.tsx'
import { featureTrack, makeView, wiggleTrack } from '../browser/engine.ts'
import TrackStack from '../browser/parts.tsx'

// Every display draws its loading scrim, error bar, too-large banner and render
// error through five swappable components. By default those are JBrowse's own,
// which are Material UI. `DisplayChromeOverlayProvider` replaces the set for
// everything below it, so JBrowse's stock wiggle and feature displays render
// their status states with your markup instead.
//
// The third track points at a URL that does not exist. That is deliberate: the
// error state is the easiest one to hold still and look at. Toggle the switch
// and watch it change from a Material `<Alert>` to plain markup you could
// restyle with your own CSS.
//
// Two seams, for two different problems:
//
//   this provider          -- reach.  Redirects JBrowse's own displays, which
//                             import DisplayChrome directly and so cannot be
//                             redirected at the import level. MUI still ends up
//                             in the bundle, it just never renders.
//   DisplayChromeBase      -- weight. Takes `overlays` as a prop and imports no
//                             toolkit at all, so MUI never enters the graph.
//                             Available when you write your own display
//                             component. Measured at 302 KB -> 140 KB eager.
const brokenTrack = {
  type: 'QuantitativeTrack',
  trackId: 'volvox_broken',
  name: 'A track that fails to load',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/does-not-exist.bw',
  },
  displayDefaults: { height: 80 },
}

const ids = ['volvox_microarray', 'volvox_genes', 'volvox_broken']

const BringYourOwnOverlays = observer(function BringYourOwnOverlays() {
  const [plain, setPlain] = useState(true)
  const view = useMemo(
    () =>
      makeView({
        tracks: [wiggleTrack, featureTrack, brokenTrack],
        loc: 'ctgA:1..20,000',
        show: ids,
      }),
    [],
  )

  // Palette is JBrowse's theme tokens, which the feature display reads for its
  // content colours. It is not the overlays -- those are what the toggle swaps.
  const stack = (
    <Palette>
      <TrackStack view={view} trackIds={ids} />
    </Palette>
  )

  return (
    <div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          paddingBottom: 8,
        }}
      >
        <input
          type="checkbox"
          checked={plain}
          onChange={event => {
            setPlain(event.target.checked)
          }}
        />
        Use my own overlays instead of JBrowse&rsquo;s Material UI ones
      </label>
      {plain ? (
        <DisplayChromeOverlayProvider value={plainChromeOverlays}>
          {stack}
        </DisplayChromeOverlayProvider>
      ) : (
        stack
      )}
    </div>
  )
})

export default BringYourOwnOverlays
