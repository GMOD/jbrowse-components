import React, { useMemo, useState } from 'react'
import { getSession, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

// locals
import {
  getBadlyPairedAlignments,
  getMatchedAlignmentFeatures,
  hasPairedReads,
} from './util'
import {
  yPos,
  useNextFrame,
  getPxFromCoordinate,
  heightFromSpecificLevel,
} from '../util'
import {
  getLongReadOrientationAbnormal,
  getLongReadOrientationColorOrDefault,
  getPairedOrientationColor,
  isAbnormalOrientation,
} from './getOrientationColor'
import type { BreakpointViewModel } from '../model'

const [LEFT, , RIGHT] = [0, 1, 2, 3] as const

const AlignmentConnections = observer(function ({
  model,
  trackId,
  parentRef,
  getTrackYPosOverride,
}: {
  model: BreakpointViewModel
  trackId: string
  parentRef: React.RefObject<SVGSVGElement>
  getTrackYPosOverride?: (trackId: string, level: number) => number
}) {
  const { views, showIntraviewLinks } = model
  const theme = useTheme()
  const session = getSession(model)
  const snap = getSnapshot(model)
  const { assemblyManager } = session
  const v0 = views[0]
  const assembly = v0 ? assemblyManager.get(v0.assemblyNames[0]!) : undefined
  useNextFrame(snap)
  const allFeatures = model.getTrackFeatures(trackId)
  const hasPaired = useMemo(() => hasPairedReads(allFeatures), [allFeatures])
  const layoutMatches = useMemo(() => {
    const layoutMatches = model.getMatchedFeaturesInLayout(
      trackId,
      hasPaired
        ? getBadlyPairedAlignments(allFeatures)
        : getMatchedAlignmentFeatures(allFeatures),
    )
    if (!hasPaired) {
      for (const m of layoutMatches) {
        m.sort((a, b) => a.clipPos - b.clipPos)
      }
    }
    return layoutMatches
  }, [allFeatures, trackId, hasPaired, model])

  const [mouseoverElt, setMouseoverElt] = useState<string>()

  let yOffset = 0
  if (parentRef.current) {
    const rect = parentRef.current.getBoundingClientRect()
    yOffset = rect.top
  }

  return assembly ? (
    <g
      fill="none"
      data-testid={layoutMatches.length ? `${trackId}-loaded` : trackId}
    >
      {layoutMatches.map(chunk => {
        const ret = []
        // we follow a path in the list of chunks, not from top to bottom, just in series
        // following x1,y1 -> x2,y2
        for (let i = 0; i < chunk.length - 1; i++) {
          const { layout: c1, feature: f1, level: level1 } = chunk[i]!
          const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!

          if (!c1 || !c2) {
            console.warn('received null layout for a overlay feature')
            return null
          }

          // disable rendering connections in a single row
          if (!showIntraviewLinks && level1 === level2) {
            return null
          }
          const f1ref = assembly.getCanonicalRefName(f1.get('refName'))
          const f2ref = assembly.getCanonicalRefName(f2.get('refName'))

          if (!f1ref || !f2ref) {
            throw new Error(`unable to find ref for ${f1ref || f2ref}`)
          }
          const r = {
            pair_orientation: f1.get('pair_orientation'),
          }

          const s1 = f1.get('strand')
          const s2 = f2.get('strand')
          const sameRef = f1ref === f2ref
          const checkOrientation = sameRef
          let orientationColor = ''
          let isAbnormal = false
          if (checkOrientation) {
            if (hasPaired) {
              orientationColor = getPairedOrientationColor(r)
              isAbnormal = isAbnormalOrientation(r)
            } else {
              orientationColor = getLongReadOrientationColorOrDefault(s1, s2)
              isAbnormal = getLongReadOrientationAbnormal(s1, s2)
            }
          }
          const p1 = c1[s1 === -1 ? LEFT : RIGHT]
          const sn1 = s2 === -1
          const p2 = hasPaired ? c2[sn1 ? LEFT : RIGHT] : c2[sn1 ? RIGHT : LEFT]
          const x1 = getPxFromCoordinate(views[level1]!, f1ref, p1)
          const x2 = getPxFromCoordinate(views[level2]!, f2ref, p2)
          const reversed1 = views[level1]!.pxToBp(x1).reversed
          const reversed2 = views[level2]!.pxToBp(x2).reversed
          const rf1 = reversed1 ? -1 : 1
          const rf2 = reversed2 ? -1 : 1
          const tracks = views.map(v => v.getTrack(trackId))
          const y1 =
            yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) -
            yOffset
          const y2 =
            yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) -
            yOffset
          const sameLevel = level1 === level2
          const abnormalSpecialRenderFlag = sameLevel && isAbnormal
          const trackHeight = abnormalSpecialRenderFlag
            ? tracks[level1].displays[0].height
            : 0
          const pf1 = hasPaired ? -1 : 1
          const y0 = heightFromSpecificLevel(
            views,
            trackId,
            level1,
            getTrackYPosOverride,
          )

          // possible todo: use totalCurveHeight to possibly make alternative
          // squiggle if the S is too small
          const path = [
            'M',
            x1,
            y1,
            'C',

            // first bezier x,y
            x1 + 200 * f1.get('strand') * rf1,
            abnormalSpecialRenderFlag
              ? Math.min(y0 - yOffset + trackHeight, y1 + trackHeight)
              : y1,

            // second bezier x,y
            x2 - 200 * f2.get('strand') * rf2 * pf1,
            abnormalSpecialRenderFlag
              ? Math.min(y0 - yOffset + trackHeight, y2 + trackHeight)
              : y2,

            // third bezier x,y
            x2,
            y2,
          ].join(' ')
          const id = `${f1.id()}-${f2.id()}`
          ret.push(
            <path
              d={path}
              key={id}
              data-testid="r1"
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
                      feature1: (
                        allFeatures.get(f1.id()) || { toJSON: () => {} }
                      ).toJSON(),
                      feature2: (
                        allFeatures.get(f2.id()) || { toJSON: () => {} }
                      ).toJSON(),
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
          )
        }
        return ret
      })}
    </g>
  ) : null
})

export default AlignmentConnections
