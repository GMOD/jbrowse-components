import Path from 'svg-path-generator'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { BreakpointViewStateModel, LayoutRecord } from '../model'
import { yPos, getPxFromCoordinate } from '../util'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

interface Chunk {
  feature: Feature
  layout: LayoutRecord
  level: number
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = jbrequire('react')

  const AlignmentInfo = observer(
    ({
      model,
      alignmentChunks,
      height,
      trackConfigId,
    }: {
      model: Instance<BreakpointViewStateModel>
      alignmentChunks: Chunk[][]
      height: number
      trackConfigId: string
    }) => {
      const { views, controlsWidth } = model
      const [mouseoverElt, setMouseoverElt] = useState()
      const trackStyleId = `alignmentsquiggles`
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: controlsWidth, flexShrink: 0 }} />
          <svg
            data-testid={
              alignmentChunks.length
                ? `${trackConfigId}-breakpoints-loaded`
                : `${trackConfigId}-breakpoints`
            }
            style={{
              width: '100%',
              zIndex: 10,
              pointerEvents: model.interactToggled ? undefined : 'none',
            }}
          >
            <g id={trackStyleId}>
              <style
                dangerouslySetInnerHTML={{
                  __html: `#${trackStyleId} > path {
                    cursor: crosshair;
                    fill: none;
                  }`,
                }}
              />
              {alignmentChunks.map(chunk => {
                const ret = []
                // we follow a path in the list of chunks, not from top to bottom, just in series
                // following x1,y1 -> x2,y2
                for (let i = 0; i < chunk.length - 1; i += 1) {
                  const { layout: c1, feature: f1, level: level1 } = chunk[i]
                  const { layout: c2, feature: f2, level: level2 } = chunk[
                    i + 1
                  ]
                  const flipMultipliers = views.map(v =>
                    v.horizontallyFlipped ? -1 : 1,
                  )
                  const x1 = getPxFromCoordinate(
                    views[level1],
                    c1[f1.get('strand') === -1 ? LEFT : RIGHT],
                  )
                  const x2 = getPxFromCoordinate(
                    views[level2],
                    c2[f2.get('strand') === -1 ? RIGHT : LEFT],
                  )

                  const tracks = views.map(v => v.getTrack(trackConfigId))

                  const y1 = yPos(trackConfigId, level1, views, tracks, c1)
                  const y2 = yPos(trackConfigId, level2, views, tracks, c2)

                  // possible todo: use totalCurveHeight to possibly make alternative squiggle if the S is too small
                  const path = Path()
                    .moveTo(x1, y1)
                    .curveTo(
                      x1 + 200 * f1.get('strand') * flipMultipliers[level1],
                      y1,
                      x2 - 200 * f2.get('strand') * flipMultipliers[level2],
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
                      stroke={mouseoverElt === id ? 'black' : '#333'}
                      strokeWidth={mouseoverElt === id ? 3 : 1}
                      fill="none"
                      onClick={evt =>
                        // eslint-disable-next-line no-console
                        console.log(
                          'add more information context for this alignment squiggle onClick',
                        )
                      }
                      onMouseOver={evt => setMouseoverElt(id)}
                      onMouseOut={evt => setMouseoverElt(undefined)}
                    />,
                  )
                }
                return ret
              })}
            </g>
          </svg>
        </div>
      )
    },
  )

  return AlignmentInfo
}
