import { useMemo } from 'react'

import { observer } from 'mobx-react'

import Palette from '../browser/Palette.tsx'
import {
  alignmentsTrack,
  featureTrack,
  makeView,
  wiggleTrack,
} from '../browser/engine.ts'
import TrackStack from '../browser/parts.tsx'

// Three different display types -- a wiggle canvas, a feature layout, and an
// alignments pileup -- stacked in one column.
//
// Nothing here knows which is which. `TrackStack` maps over track ids and
// mounts each one's `activeDisplay.RenderingComponent`, and the differences
// between a BigWig and a BAM are entirely inside the engine. Adding a new
// display type to this page means adding a string to `trackIds`.
const ids = ['volvox_microarray', 'volvox_genes', 'volvox_bam']

const StackOfTracks = observer(function StackOfTracks() {
  const view = useMemo(
    () =>
      makeView({
        tracks: [wiggleTrack, featureTrack, alignmentsTrack],
        loc: 'ctgA:1..20,000',
        show: ids,
      }),
    [],
  )
  // Palette supplies JBrowse's augmented theme tokens, which the feature and
  // alignments displays read to colour their content. See Palette.tsx -- the
  // wiggle-only pages before this one need no such wrapper.
  return (
    <Palette>
      <TrackStack view={view} trackIds={ids} style={{ cursor: 'grab' }} />
    </Palette>
  )
})

export default StackOfTracks
