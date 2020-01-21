import Path from 'svg-path-generator'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { BreakpointViewModel, Breakend } from '../model'
import { yPos, getPxFromCoordinate } from '../util'

const [LEFT] = [0, 1, 2, 3]

function findMatchingAlt(feat1: Feature, feat2: Feature) {
  const candidates: Record<string, Breakend> = {}
  feat1.get('ALT').forEach((alt: Breakend) => {
    candidates[alt.MatePosition] = alt
  })
  return candidates[`${feat2.get('refName')}:${feat2.get('start') + 1}`]
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = jbrequire('react')

  return observer(
    ({
      model,
      height,
      trackConfigId,
    }: {
      model: BreakpointViewModel
      height: number
      trackConfigId: string
    }) => {
      const { views } = model
      const features = model.getMatchedBreakendFeatures(trackConfigId)
      const layoutMatches = model.getMatchedFeaturesInLayout(
        trackConfigId,
        features,
      )
      const [mouseoverElt, setMouseoverElt] = useState()
      return (
        <g
          stroke="green"
          strokeWidth={5}
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
              const id = `${f1.id()}-${f2.id()}`
              const flipMultipliers = views.map(v =>
                v.horizontallyFlipped ? -1 : 1,
              )
              const relevantAlt = findMatchingAlt(f1, f2)
              if (!c1 || !c2) return null
              const x1 = getPxFromCoordinate(
                views[level1],
                f1.get('refName'),
                c1[LEFT],
              )
              const x2 = getPxFromCoordinate(
                views[level2],
                f2.get('refName'),
                c2[LEFT],
              )

              const tracks = views.map(v => v.getTrack(trackConfigId))
              const y1 = yPos(trackConfigId, level1, views, tracks, c1)
              const y2 = yPos(trackConfigId, level2, views, tracks, c2)
              if (!relevantAlt) {
                console.warn(
                  'the relevant ALT allele was not found, cannot render',
                )
              } else {
                const path = Path()
                  .moveTo(
                    x1 -
                      20 *
                        (relevantAlt.Join === 'left' ? -1 : 1) *
                        flipMultipliers[level1],
                    y1,
                  )
                  .lineTo(x1, y1)
                  .lineTo(x2, y2)
                  .lineTo(
                    x2 -
                      20 *
                        (relevantAlt.MateDirection === 'left' ? 1 : -1) *
                        flipMultipliers[level2],
                    y2,
                  )
                  .end()
                ret.push(
                  <path
                    d={path}
                    key={JSON.stringify(path)}
                    strokeWidth={id === mouseoverElt ? 10 : 5}
                    onMouseOver={elt => setMouseoverElt(id)}
                    onMouseOut={elt => setMouseoverElt(undefined)}
                  />,
                )
              }
            }
            return ret
          })}
        </g>
      )
    },
  )
}
