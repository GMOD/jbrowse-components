import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { observer } from 'mobx-react'

import { isViewReady } from './parts.tsx'

import type { BrowserView } from './engine.ts'

// A coordinate ruler, written against the same view model the tracks use. This
// is chrome: nothing needs it, and that is the point of putting it on its own
// page. You add the pieces your app wants and skip the rest.
//
// The maths is two view methods. `dynamicBlocks.contentBlocks` is exactly what
// is on screen right now (one entry per contiguous region, so a discontinuous
// view gives several), and `bpToPx` turns a genomic coordinate into a pixel
// offset. `chooseGridPitch` is a core helper that picks a round tick spacing
// for the current zoom, so labels stay legible instead of colliding.
export const RULER_HEIGHT = 22

const Ruler = observer(function Ruler({ view }: { view: BrowserView }) {
  if (!isViewReady(view)) {
    return <div style={{ height: RULER_HEIGHT }} />
  }
  const { majorPitch } = chooseGridPitch(view.bpPerPx, 100, 15)

  return (
    <div
      style={{
        position: 'relative',
        height: RULER_HEIGHT,
        overflow: 'hidden',
        borderBottom: '1px solid',
        borderColor: 'color-mix(in srgb, currentColor 25%, transparent)',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      {view.dynamicBlocks.contentBlocks.flatMap(block => {
        const first = Math.ceil(block.start / majorPitch) * majorPitch
        const ticks = []
        for (let bp = first; bp < block.end; bp += majorPitch) {
          const px = view.bpToPx({ refName: block.refName, coord: bp })
          if (px) {
            ticks.push(
              <span
                key={`${block.key}-${bp}`}
                style={{
                  position: 'absolute',
                  left: px.offsetPx - view.offsetPx,
                  top: 0,
                  paddingLeft: 3,
                  borderLeft: '1px solid',
                  borderColor:
                    'color-mix(in srgb, currentColor 35%, transparent)',
                  height: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                {bp.toLocaleString()}
              </span>,
            )
          }
        }
        return ticks
      })}
    </div>
  )
})

export default Ruler
