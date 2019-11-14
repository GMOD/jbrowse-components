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
interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const [LEFT, TOP, , BOTTOM] = [0, 1, 2, 3]

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
  const VariantInfo = observer(
    ({
      model,
      alignmentChunks = [],
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
                ? `${trackConfigId}-vcfbreakends-loaded`
                : `${trackConfigId}-vcfbreakends`
            }
            style={{
              width: '100%',
              zIndex: 10,
              pointerEvents: model.interactToggled ? undefined : 'none',
            }}
          >
            {alignmentChunks.map(chunk => {
              // we follow a path in the list of chunks, not from top to bottom, just in series
              // following x1,y1 -> x2,y2
              const ret = []
              for (let i = 0; i < chunk.length; i += 1) {
                const { layout: c1, feature: f1, level: level1 } = chunk[i]
                const level2 = level1 === 0 ? 1 : 0

                const flipMultipliers = views.map(v =>
                  v.horizontallyFlipped ? -1 : 1,
                )
                const info = f1.get('INFO')
                const chr2 = info.CHR2[0]
                const end2 = info.END[0]
                const [myDirection, mateDirection] = info.STRANDS[0].split('')

                const r = views[level2].bpToPx({ refName: chr2, coord: end2 })
                if (r) {
                  console.log(
                    chr2,
                    end2,
                    r,
                    r.offsetPx - views[level2].offsetPx,
                  )
                  const left = r.offsetPx - views[1].offsetPx
                  const c2: LayoutRecord = [left, 0, left + 1, 0]

                  const x1 = calc(views[level1], c1[LEFT])
                  const x2 = calc(
                    views[level2],
                    r.offsetPx - views[level2].offsetPx,
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
                  const yPos = (level: number, c: LayoutRecord) =>
                    clamp(
                      c[TOP] - tracks[level].scrollTop + cheight(c1),
                      0,
                      tracks[level].height,
                    ) + added(level)

                  const y1 = yPos(level1, c1)
                  const y2 = yPos(level2, c2)
                  const path = Path()
                    .moveTo(
                      x1 -
                        20 *
                          (myDirection === '+' ? -1 : 1) *
                          flipMultipliers[level1],
                      y1,
                    )
                    .lineTo(x1, y1)
                    .lineTo(x2, y2)
                    .lineTo(
                      x2 -
                        20 *
                          (mateDirection === '+' ? 1 : -1) *
                          flipMultipliers[level2],
                      y2,
                    )
                    .end()
                  ret.push(
                    <path
                      d={path}
                      key={JSON.stringify(path)}
                      stroke="green"
                      strokeWidth={5}
                      fill="none"
                    />,
                  )
                }
              }
              return ret
            })}
          </svg>
        </div>
      )
    },
  )

  return VariantInfo
}
