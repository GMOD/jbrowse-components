import { useMemo } from 'react'

import { observer } from 'mobx-react'

import { makeView, wiggleTrack } from '../browser/engine.ts'
import { TrackRow, isViewReady, useViewWidth } from '../browser/parts.tsx'

// The smallest thing that puts genomic data on screen: measure a div, mount one
// track's display in it. No header, no ruler, no track label, no MUI theme.
//
// It doesn't pan or zoom yet -- that is the next example.
const OneTrack = observer(function OneTrack() {
  const view = useMemo(
    () =>
      makeView({
        tracks: [wiggleTrack],
        loc: 'ctgA:1..50,000',
        show: ['volvox_microarray'],
      }),
    [],
  )
  const ref = useViewWidth(view)

  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      {isViewReady(view) ? (
        <TrackRow view={view} trackId="volvox_microarray" />
      ) : null}
    </div>
  )
})

export default OneTrack
