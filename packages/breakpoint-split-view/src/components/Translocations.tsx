import Path from 'svg-path-generator'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { BreakpointViewStateModel, LayoutRecord } from '../model'
import { yPos, getPxFromCoordinate } from '../util'

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

  const [LEFT] = [0, 1, 2, 3]

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
                ? `${trackConfigId}-vcftranslocations-loaded`
                : `${trackConfigId}-vcftranslocations`
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
                  const left = r.offsetPx - views[1].offsetPx
                  const c2: LayoutRecord = [left, 0, left + 1, 0]

                  const x1 = getPxFromCoordinate(views[level1], c1[LEFT])
                  const x2 = left

                  const tracks = views.map(v => v.getTrack(trackConfigId))
                  const y1 = yPos(trackConfigId, level1, views, tracks, c1)
                  const y2 = yPos(trackConfigId, level2, views, tracks, c2)

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
