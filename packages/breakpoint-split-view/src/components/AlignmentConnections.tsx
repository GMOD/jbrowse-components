import Path from 'svg-path-generator'
import { BreakpointViewModel } from '../model'
import { yPos, getPxFromCoordinate } from '../util'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = jbrequire('react')

  return observer(
    ({
      model,
      trackConfigId,
    }: {
      model: BreakpointViewModel
      height: number
      trackConfigId: string
    }) => {
      const { views, showIntraviewLinks } = model
      const session = getSession(model)
      const totalFeatures = model.getTrackFeatures(trackConfigId)
      const features = model.hasPairedReads(trackConfigId)
        ? model.getBadlyPairedAlignments(trackConfigId)
        : model.getMatchedAlignmentFeatures(trackConfigId)
      const layoutMatches = model.getMatchedFeaturesInLayout(
        trackConfigId,
        features,
      )
      layoutMatches.forEach(m => {
        m.sort((a, b) => a.feature.get('clipPos') - b.feature.get('clipPos'))
      })
      const [mouseoverElt, setMouseoverElt] = useState()
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

              const x1 = getPxFromCoordinate(
                views[level1],
                f1.get('refName'),
                c1[f1.get('strand') === -1 ? LEFT : RIGHT],
              )
              const x2 = getPxFromCoordinate(
                views[level2],
                f2.get('refName'),
                c2[f2.get('strand') === -1 ? RIGHT : LEFT],
              )
              const reversed1 = views[level1].pxToBp(x1).reversed
              const reversed2 = views[level2].pxToBp(x2).reversed

              const tracks = views.map(v => v.getTrack(trackConfigId))

              const y1 = yPos(trackConfigId, level1, views, tracks, c1)
              const y2 = yPos(trackConfigId, level2, views, tracks, c2)

              // possible todo: use totalCurveHeight to possibly make alternative squiggle if the S is too small
              const path = Path()
                .moveTo(x1, y1)
                .curveTo(
                  x1 + 200 * f1.get('strand') * (reversed1 ? -1 : 1),
                  y1,
                  x2 - 200 * f2.get('strand') * (reversed2 ? -1 : 1),
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
                    const featureWidget = session.addWidget(
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
                    session.showWidget(featureWidget)
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
}
