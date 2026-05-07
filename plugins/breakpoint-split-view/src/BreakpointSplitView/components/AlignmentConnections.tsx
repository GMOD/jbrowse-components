import { getSession, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import {
  getLongReadOrientationAbnormal,
  getLongReadOrientationColorOrDefault,
  getPairedOrientationColor,
  isAbnormalOrientation,
} from './getOrientationColor.tsx'
import {
  LEFT,
  RIGHT,
  getCanonicalRefs,
  getTestId,
  useMouseoverElt,
} from './overlayUtils.tsx'

import type { OverlayProps } from './overlayUtils.tsx'

const AlignmentConnections = observer(function AlignmentConnections({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
}: OverlayProps) {
  const { interactiveOverlay, views, showIntraviewLinks, assembly } = model
  const theme = useTheme()
  const session = getSession(model)
  const [mouseoverElt, setMouseoverElt] = useMouseoverElt()
  const match = model.overlayMatches.get(trackId)
  const { tracks, yOffsets, heights, getX, getY } = model.getTrackOverlayData(
    trackId,
    yOffsetsOverride,
    domYOffsets,
  )
  const layoutMatches = match?.layoutMatches ?? []
  const hasPaired = match?.hasPairedReads
  const allFeatures = match?.allFeatures

  return assembly && match ? (
    <g fill="none" data-testid={getTestId(trackId, layoutMatches.length > 0)}>
      {layoutMatches.flatMap(chunk =>
        chunk.slice(0, -1).flatMap((item, i) => {
          const { layout: c1, feature: f1, level: level1 } = item
          const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!

          if (tracks[level1]?.minimized || tracks[level2]?.minimized) {
            return []
          }
          if (!showIntraviewLinks && level1 === level2) {
            return []
          }
          const { f1ref, f2ref } = getCanonicalRefs(
            assembly,
            f1.get('refName'),
            f2.get('refName'),
          )
          const s1 = f1.get('strand')!
          const s2 = f2.get('strand')!
          const sameRef = f1ref === f2ref
          let orientationColor = ''
          let isAbnormal = false
          if (sameRef) {
            if (hasPaired) {
              const r = { pair_orientation: f1.get('pair_orientation') }
              orientationColor = getPairedOrientationColor(r)
              isAbnormal = isAbnormalOrientation(r)
            } else {
              orientationColor = getLongReadOrientationColorOrDefault(s1, s2)
              isAbnormal = getLongReadOrientationAbnormal(s1, s2)
            }
          }
          const p1 = c1[s1 === -1 ? LEFT : RIGHT]
          const sn2 = s2 === -1
          const p2 = hasPaired ? c2[sn2 ? LEFT : RIGHT] : c2[sn2 ? RIGHT : LEFT]
          const x1 = getX(level1, f1ref, p1) ?? 0
          const x2 = getX(level2, f2ref, p2) ?? 0
          const rf1 = views[level1]!.pxToBp(x1).reversed ? -1 : 1
          const rf2 = views[level2]!.pxToBp(x2).reversed ? -1 : 1
          const y1 = getY(level1, c1)
          const y2 = getY(level2, c2)
          const sameLevel = level1 === level2
          const abnormalSpecialRenderFlag = sameLevel && isAbnormal
          const trackHeight = abnormalSpecialRenderFlag ? heights[level1]! : 0
          const pf1 = hasPaired ? -1 : 1
          const y0 = yOffsets[level1]!

          const path = [
            'M',
            x1,
            y1,
            'C',
            x1 + 200 * s1 * rf1,
            abnormalSpecialRenderFlag
              ? Math.min(y0 + trackHeight, y1 + trackHeight)
              : y1,
            x2 - 200 * s2 * rf2 * pf1,
            abnormalSpecialRenderFlag
              ? Math.min(y0 + trackHeight, y2 + trackHeight)
              : y2,
            x2,
            y2,
          ].join(' ')
          const id = `${f1.id()}-${f2.id()}`
          return [
            <path
              d={path}
              key={id}
              data-testid="r1"
              pointerEvents={interactiveOverlay ? 'auto' : undefined}
              strokeWidth={mouseoverElt === id ? 5 : 1}
              {...getStrokeProps(
                orientationColor || theme.palette.text.disabled,
              )}
              onClick={() => {
                const featureWidget = session.addWidget?.(
                  'BreakpointAlignmentsWidget',
                  'breakpointAlignments',
                  {
                    featureData: {
                      feature1: allFeatures?.get(f1.id())?.toJSON(),
                      feature2: allFeatures?.get(f2.id())?.toJSON(),
                    },
                  },
                )
                session.showWidget?.(featureWidget)
              }}
              onMouseOver={() => {
                setMouseoverElt(id)
              }}
              onMouseOut={() => {
                setMouseoverElt(undefined)
              }}
            />,
          ]
        }),
      )}
    </g>
  ) : null
})

export default AlignmentConnections
