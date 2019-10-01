/* eslint-disable @typescript-eslint/explicit-function-return-type */
import Path from 'svg-path-generator'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { BreakpointViewStateModel } from '../models/BreakpointSplitView'

interface Chunk {
  feature: Feature
  layout: [number, number, number, number]
  level: number
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const [LEFT, TOP, RIGHT, BOTTOM] = [0, 1, 2, 3]

  function calc(
    view: Instance<typeof LinearGenomeViewStateModel>,
    coord: number,
  ) {
    return coord / view.bpPerPx - view.offsetPx
  }
  function cheight(chunk: [number, number, number, number]) {
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
      const { topLGV, bottomLGV, controlsWidth } = model
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: controlsWidth, flexShrink: 0 }} />
          <svg
            data-testid={
              alignmentChunks.length
                ? 'breakpoint-split-squiggles-loaded'
                : 'breakpoint-split-squiggles'
            }
            style={{ width: '100%', zIndex: 10000, pointerEvents: 'none' }}
          >
            {alignmentChunks.map(chunk => {
              const ret = []
              // we follow a path in the list of chunks, not from top to bottom, just in series
              // following x1,y1 -> x2,y2
              for (let i = 0; i < chunk.length - 1; i += 1) {
                const { layout: c1, feature: f1, level: level1 } = chunk[i]
                const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]
                const x1 = calc(
                  level1 === 0 ? topLGV : bottomLGV,
                  c1[f1.get('strand') === -1 ? LEFT : RIGHT],
                )
                const x2 = calc(
                  level2 === 0 ? topLGV : bottomLGV,
                  c2[f2.get('strand') === -1 ? RIGHT : LEFT],
                )
                const t1 = topLGV.getTrack(trackConfigId).scrollTop
                const t2 = bottomLGV.getTrack(trackConfigId).scrollTop
                const added = (level: number) => {
                  return level === 0
                    ? topLGV.headerHeight +
                        topLGV.scaleBarHeight +
                        topLGV.getTrackPos(trackConfigId) +
                        model.headerHeight +
                        3
                    : model.headerHeight +
                        topLGV.height +
                        3 +
                        bottomLGV.headerHeight +
                        bottomLGV.scaleBarHeight +
                        bottomLGV.getTrackPos(trackConfigId) +
                        10 // margin
                }

                const y1 =
                  c1[BOTTOM] +
                  added(level1) -
                  (level1 === 0 ? t1 : t2) -
                  cheight(c1) / 2
                const y2 =
                  c2[TOP] +
                  added(level2) -
                  (level2 === 0 ? t1 : t2) +
                  cheight(c2) / 2

                // possible todo: use totalCurveHeight to possibly make alternative squiggle if the S is too small
                const path = Path()
                  .moveTo(x1, y1)
                  .curveTo(
                    x1 + 200 * f1.get('strand'),
                    y1,
                    x2 - 200 * f2.get('strand'),
                    y2,
                    x2,
                    y2,
                  )
                  .end()
                ret.push(
                  <path
                    d={path}
                    key={JSON.stringify(path)}
                    stroke="black"
                    fill="none"
                  />,
                )
              }
              return ret
            })}
          </svg>
        </div>
      )
    },
  )

  return AlignmentInfo
}
