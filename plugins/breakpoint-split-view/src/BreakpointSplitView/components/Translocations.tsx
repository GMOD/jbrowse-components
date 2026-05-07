import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildBreakpointPath,
  createVariantMouseHandlers,
  getTestId,
  strandToSign,
  useMouseoverElt,
} from './overlayUtils.tsx'

import type { OverlayProps } from './overlayUtils.tsx'
import type { LayoutRecord } from '../types.ts'

const Translocations = observer(function Translocations({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
}: OverlayProps) {
  const { interactiveOverlay, views, assembly } = model
  const session = getSession(model)
  const [mouseoverElt, setMouseoverElt] = useMouseoverElt()
  const match = model.overlayMatches.get(trackId)
  const { tracks, getX, getY } = model.getTrackOverlayData(
    trackId,
    yOffsetsOverride,
    domYOffsets,
  )
  const layoutMatches = match?.layoutMatches ?? []
  const totalFeatures = match?.allFeatures

  // we hardcode the TRA to go to the "other view" and if there is none, we
  // just return null here note: would need to do processing of the INFO
  // CHR2/END and see which view could contain those coordinates to really do
  // it properly
  return assembly && match && views.length >= 2 ? (
    <g
      fill="none"
      stroke="green"
      strokeWidth={5}
      data-testid={getTestId(trackId, layoutMatches.length > 0)}
    >
      {layoutMatches.flatMap(chunk =>
        chunk.flatMap(({ layout: c1, feature: f1, level: level1 }) => {
          const level2 = level1 === 0 ? 1 : 0
          if (tracks[level1]?.minimized || tracks[level2]?.minimized) {
            return []
          }
          const id = f1.id()

          const info = f1.get('INFO')
          const chr2 = info.CHR2[0]
          const end2 = info.END[0]
          const res = info.STRANDS?.[0]?.split('')
          const [myDirection, mateDirection] = res ?? ['.', '.']

          const x2 = getX(level2, chr2, end2)
          if (x2 == null) {
            return []
          }
          const c2: LayoutRecord = [x2, 0, x2 + 1, 0]
          const x1 = getX(level1, f1.get('refName'), c1[LEFT]) ?? 0
          const reversed1 = views[level1]!.pxToBp(x1).reversed
          const reversed2 = views[level2]!.pxToBp(x2).reversed

          const y1 = getY(level1, c1)
          const y2 = getY(level2, c2)
          const x1Tick =
            x1 - 20 * strandToSign(myDirection) * (reversed1 ? -1 : 1)
          const x2Tick =
            x2 - 20 * strandToSign(mateDirection) * (reversed2 ? -1 : 1)
          const path = buildBreakpointPath(x1, y1, x2, y2, x1Tick, x2Tick)

          return [
            <path
              d={path}
              key={JSON.stringify(path)}
              pointerEvents={interactiveOverlay ? 'auto' : undefined}
              strokeWidth={id === mouseoverElt ? 10 : 5}
              {...createVariantMouseHandlers(
                id,
                setMouseoverElt,
                session,
                totalFeatures?.get(id)?.toJSON(),
              )}
            />,
          ]
        }),
      )}
    </g>
  ) : null
})

export default Translocations
