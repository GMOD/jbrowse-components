import Path from 'svg-path-generator'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { clamp, bpToPx } from '@gmod/jbrowse-core/util'
import { BreakpointViewStateModel } from '../models/BreakpointSplitView'

type LayoutRecord = [number, number, number, number]
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
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: controlsWidth, flexShrink: 0 }} />
          <svg
            data-testid={
              alignmentChunks.length ? 'vcfbreakends-loaded' : 'vcfbreakends'
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
                const flipMultipliers = views.map(v =>
                  v.horizontallyFlipped ? -1 : 1,
                )
                const relevantAlt = findMatchingAlt(f1, f2)

                const x1 = calc(views[level1], c1[LEFT])
                const x2 = calc(views[level2], c2[LEFT])

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
                    c[TOP] - tracks[level].scrollTop + cheight(c) / 2,
                    0,
                    tracks[level].height,
                  ) + added(level)

                const y1 = yPos(level1, c1)
                const y2 = yPos(level2, c2)
                if (!relevantAlt) {
                  console.warn(
                    'the relevant ALT allele was not found, cannot render',
                  )
                } else {
                  const path = Path()
                    .moveTo(
                      x1 -
                        100 *
                          (relevantAlt.Join === 'left' ? 1 : -1) *
                          flipMultipliers[level1],
                      y1,
                    )
                    .lineTo(x1, y1)
                    .lineTo(x2, y2)
                    .lineTo(
                      x2 -
                        100 *
                          (relevantAlt.MateDirection === 'left' ? 1 : -1) *
                          flipMultipliers[level2],
                      y2,
                    )
                    .end()
                  ret.push(
                    <path
                      d={path}
                      key={JSON.stringify(path)}
                      stroke="red"
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

  return AlignmentInfo
}
