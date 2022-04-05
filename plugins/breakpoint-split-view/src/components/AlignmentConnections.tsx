import React, { useMemo, useState } from 'react'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import Path from 'svg-path-generator'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { getSession, Feature } from '@jbrowse/core/util'

// locals
import { yPos, useNextFrame, getPxFromCoordinate } from '../util'
import { BreakpointViewModel } from '../model'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

// this finds candidate alignment features, aimed at plotting split reads
// from BAM/CRAM files
function getBadlyPairedAlignments(features: CompositeMap<string, Feature>) {
  const candidates: Record<string, Feature[]> = {}
  const alreadySeen = new Set<string>()

  // this finds candidate features that share the same name
  for (const feature of features.values()) {
    const flags = feature.get('flags')
    const id = feature.id()
    const unmapped = flags & 4
    const correctlyPaired = flags & 2

    if (!alreadySeen.has(id) && !correctlyPaired && !unmapped) {
      const n = feature.get('name')
      if (!candidates[n]) {
        candidates[n] = []
      }
      candidates[n].push(feature)
    }
    alreadySeen.add(feature.id())
  }

  return Object.values(candidates).filter(v => v.length > 1)
}

// this finds candidate alignment features, aimed at plotting split reads
// from BAM/CRAM files
function getMatchedAlignmentFeatures(features: CompositeMap<string, Feature>) {
  const candidates: Record<string, Feature[]> = {}
  const alreadySeen = new Set<string>()

  // this finds candidate features that share the same name
  for (const feature of features.values()) {
    const id = feature.id()
    const unmapped = feature.get('flags') & 4
    if (!alreadySeen.has(id) && !unmapped) {
      const n = feature.get('name')
      if (!candidates[n]) {
        candidates[n] = []
      }
      candidates[n].push(feature)
    }
    alreadySeen.add(feature.id())
  }

  return Object.values(candidates).filter(v => v.length > 1)
}

function hasPairedReads(features: CompositeMap<string, Feature>) {
  return features.find(f => f.get('flags') & 64)
}

const AlignmentConnections = observer(
  ({
    model,
    trackConfigId,
    parentRef,
  }: {
    model: BreakpointViewModel
    trackConfigId: string
    parentRef: React.RefObject<SVGSVGElement>
  }) => {
    const { views, showIntraviewLinks } = model

    const session = getSession(model)
    const snap = getSnapshot(model)
    const { assemblyManager } = session
    const assembly = assemblyManager.get(views[0].assemblyNames[0])
    useNextFrame(snap)
    const totalFeatures = model.getTrackFeatures(trackConfigId)
    const hasPaired = useMemo(
      () => hasPairedReads(totalFeatures),
      [totalFeatures],
    )

    const layoutMatches = useMemo(() => {
      const features = hasPaired
        ? getBadlyPairedAlignments(totalFeatures)
        : getMatchedAlignmentFeatures(totalFeatures)
      const layoutMatches = model.getMatchedFeaturesInLayout(
        trackConfigId,
        features,
      )
      if (!hasPaired) {
        layoutMatches.forEach(m => {
          m.sort((a, b) => a.feature.get('clipPos') - b.feature.get('clipPos'))
        })
      }
      return layoutMatches
    }, [totalFeatures, trackConfigId, hasPaired, model])

    const [mouseoverElt, setMouseoverElt] = useState<string>()

    let yOffset = 0
    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect()
      yOffset = rect.top
    }

    if (!assembly) {
      console.warn('Unable to read assembly')
      return null
    }

    return (
      <g
        stroke="#333"
        fill="none"
        data-testid={
          layoutMatches.length ? `${trackConfigId}-loaded` : trackConfigId
        }
      >
        {layoutMatches.map(chunk => {
          const ret = []
          // we follow a path in the list of chunks, not from top to bottom, just in series
          // following x1,y1 -> x2,y2
          for (let i = 0; i < chunk.length - 1; i += 1) {
            const { layout: c1, feature: f1, level: level1 } = chunk[i]
            const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]

            if (!c1 || !c2) {
              console.warn('received null layout for a overlay feature')
              return null
            }

            // disable rendering connections in a single level
            if (!showIntraviewLinks && level1 === level2) {
              return null
            }
            const f1origref = f1.get('refName')
            const f2origref = f2.get('refName')
            const f1ref = assembly.getCanonicalRefName(f1origref)
            const f2ref = assembly.getCanonicalRefName(f2origref)

            if (!f1ref || !f2ref) {
              throw new Error(`unable to find ref for ${f1ref || f2ref}`)
            }

            const s1 = f1.get('strand')
            const s2 = f2.get('strand')
            const p1 = hasPaired
              ? c1[s1 === -1 ? LEFT : RIGHT]
              : c1[s1 === -1 ? LEFT : RIGHT]
            const p2 = hasPaired
              ? c2[s2 === -1 ? LEFT : RIGHT]
              : c2[s2 === -1 ? RIGHT : LEFT]
            const x1 = getPxFromCoordinate(views[level1], f1ref, p1)
            const x2 = getPxFromCoordinate(views[level2], f2ref, p2)
            const reversed1 = views[level1].pxToBp(x1).reversed
            const reversed2 = views[level2].pxToBp(x2).reversed

            const tracks = views.map(v => v.getTrack(trackConfigId))

            const y1 = yPos(trackConfigId, level1, views, tracks, c1) - yOffset
            const y2 = yPos(trackConfigId, level2, views, tracks, c2) - yOffset

            // possible todo: use totalCurveHeight to possibly make alternative
            // squiggle if the S is too small
            const path = Path()
              .moveTo(x1, y1)
              .curveTo(
                x1 + 200 * f1.get('strand') * (reversed1 ? -1 : 1),
                y1,
                x2 -
                  200 *
                    f2.get('strand') *
                    (reversed2 ? -1 : 1) *
                    (hasPaired ? -1 : 1),
                y2,
                x2,
                y2,
              )
              .end()
            const id = `${f1.id()}-${f2.id()}`
            ret.push(
              <path
                d={path}
                key={id}
                data-testid="r1"
                strokeWidth={mouseoverElt === id ? 5 : 1}
                onClick={() => {
                  const featureWidget = session.addWidget?.(
                    'BreakpointAlignmentsWidget',
                    'breakpointAlignments',
                    {
                      featureData: {
                        feature1: (
                          totalFeatures.get(f1.id()) || { toJSON: () => {} }
                        ).toJSON(),
                        feature2: (
                          totalFeatures.get(f2.id()) || { toJSON: () => {} }
                        ).toJSON(),
                      },
                    },
                  )
                  session.showWidget?.(featureWidget)
                }}
                onMouseOver={() => setMouseoverElt(id)}
                onMouseOut={() => setMouseoverElt(undefined)}
              />,
            )
          }
          return ret
        })}
      </g>
    )
  },
)

export default AlignmentConnections
