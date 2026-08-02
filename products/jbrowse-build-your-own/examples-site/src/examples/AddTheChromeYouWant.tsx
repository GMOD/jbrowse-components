import { useMemo } from 'react'

import {
  DisplayChromeOverlayProvider,
  plainChromeOverlays,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Palette from '../browser/Palette.tsx'
import Ruler, { RULER_HEIGHT } from '../browser/Ruler.tsx'
import {
  alignmentsTrack,
  featureTrack,
  makeView,
  wiggleTrack,
} from '../browser/engine.ts'
import {
  TrackRow,
  ZoomHint,
  isViewReady,
  usePanZoom,
  useViewWidth,
} from '../browser/parts.tsx'

// The end of the arc: pan, zoom, three kinds of track, your own status
// overlays, your own ruler, your own track labels. No Material UI, no theme
// provider, no CSS-in-JS in your page.
//
// The labels are a plain flex row next to each track, which is the cheapest
// thing that works. JBrowse's own label layer does more (drag to reorder, a
// per-track menu, an overlap mode that floats the label over the data) and if
// you want those you should use the full component rather than rebuild them.
// Knowing where that line is for your app is the whole point of starting here.
const tracks = [
  { id: 'volvox_microarray', label: 'Microarray' },
  { id: 'volvox_genes', label: 'Genes' },
  { id: 'volvox_bam', label: 'Reads' },
]
const ids = tracks.map(t => t.id)
const LABEL_WIDTH = 90

const AddTheChromeYouWant = observer(function AddTheChromeYouWant() {
  const view = useMemo(
    () =>
      makeView({
        tracks: [wiggleTrack, featureTrack, alignmentsTrack],
        loc: 'ctgA:1..20,000',
        show: ids,
      }),
    [],
  )
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)

  return (
    <Palette>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: LABEL_WIDTH, flex: 'none' }}>
            <div style={{ height: RULER_HEIGHT }} />
            {tracks.map(t => (
              <TrackLabel
                key={t.id}
                view={view}
                trackId={t.id}
                label={t.label}
              />
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Ruler view={view} />
            <div
              ref={ref}
              {...props}
              style={{
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none',
                cursor: 'grab',
              }}
            >
              <ZoomHint show={hint} />
              {isViewReady(view)
                ? ids.map(id => <TrackRow key={id} view={view} trackId={id} />)
                : null}
            </div>
          </div>
        </div>
      </DisplayChromeOverlayProvider>
    </Palette>
  )
})

// Reads the display's own height so the label stays aligned when a track is
// resized or a display grows to fit its content.
const TrackLabel = observer(function TrackLabel({
  view,
  trackId,
  label,
}: {
  view: ReturnType<typeof makeView>
  trackId: string
  label: string
}) {
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
  if (!track) {
    return null
  }
  return (
    <div
      style={{
        height: track.activeDisplay.height,
        fontSize: '0.75rem',
        paddingRight: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
})

export default AddTheChromeYouWant
