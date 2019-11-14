import Path from 'svg-path-generator'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { clamp, bpToPx } from '@gmod/jbrowse-core/util'
import { BreakpointViewStateModel, LayoutRecord } from '../model'
import { yPos, getPxFromCoordinate } from '../util'

const [LEFT, TOP, , BOTTOM] = [0, 1, 2, 3]

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

  const VariantInfo = observer(
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

                const x1 = getPxFromCoordinate(views[level1], c1[LEFT])
                const x2 = getPxFromCoordinate(views[level2], c2[LEFT])

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
