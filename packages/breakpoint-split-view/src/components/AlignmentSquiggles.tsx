import Path from 'svg-path-generator'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { clamp } from '@gmod/jbrowse-core/util'
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
      const { views, controlsWidth } = model
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
                    model.headerHeight +
                    3
                  )
                }

                // calculate the yPos, but clamp to the visible scroll region of the track
                const yPos = (
                  level: number,
                  c: [number, number, number, number],
                ) =>
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
