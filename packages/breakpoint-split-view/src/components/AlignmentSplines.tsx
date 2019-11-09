import Path from 'svg-path-generator'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { clamp, bpToPx } from '@gmod/jbrowse-core/util'
import { BreakpointViewStateModel, LayoutRecord } from '../model'

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

  const [LEFT, TOP, RIGHT, BOTTOM] = [0, 1, 2, 3]

  function calc(
    view: Instance<typeof LinearGenomeViewStateModel>,
    coord: number,
  ) {
    const region = { start: 0, end: view.totalBp }
    const { bpPerPx, horizontallyFlipped, offsetPx } = view
    return bpToPx(coord, region, bpPerPx, horizontallyFlipped) - offsetPx
  }
  function cheight(chunk: LayoutRecord) {
    return chunk[BOTTOM] - chunk[TOP]
  }
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
                  const x1 = calc(
                    views[level1],
                    c1[f1.get('strand') === -1 ? LEFT : RIGHT],
                  )
                  const x2 = calc(
                    views[level2],
                    c2[f2.get('strand') === -1 ? RIGHT : LEFT],
                  )

                  const tracks = views.map(v => v.getTrack(trackConfigId))
                  const added = (level: number) => {
                    const heightUpUntilThisPoint = views
                      .slice(0, level)
                      .map(v => v.height + 7)
                      .reduce((a, b) => a + b, 0)
                    return (
                      heightUpUntilThisPoint +
                      views[level].headerHeight +
                      views[level].scaleBarHeight +
                      views[level].getTrackPos(trackConfigId) +
                      1
                    )
                  }

                  // calculate the yPos, but clamp to the visible scroll region of the track
                  const yPos = (level: number, c: LayoutRecord) =>
                    clamp(
                      c[TOP] - tracks[level].scrollTop + cheight(c) / 2,
                      0,
                      tracks[level].height,
                    ) + added(level)

                  const y1 = yPos(level1, c1)
                  const y2 = yPos(level2, c2)

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
