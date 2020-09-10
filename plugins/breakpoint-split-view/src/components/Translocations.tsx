import Path from 'svg-path-generator'
import { BreakpointViewModel, LayoutRecord } from '../model'
import { yPos, getPxFromCoordinate } from '../util'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = jbrequire('react')

  const [LEFT] = [0, 1, 2, 3]

  return observer(
    ({
      model,
      trackConfigId,
    }: {
      model: BreakpointViewModel
      height: number
      trackConfigId: string
    }) => {
      const { views } = model
      const session = getSession(model)
      const features = model.getMatchedTranslocationFeatures(trackConfigId)
      const totalFeatures = model.getTrackFeatures(trackConfigId)
      const layoutMatches = model.getMatchedFeaturesInLayout(
        trackConfigId,
        features,
      )
      const [mouseoverElt, setMouseoverElt] = useState()

      // we hardcode the TRA to go to the "other view" and
      // if there is none, we just return null here
      // note: would need to do processing of the INFO CHR2/END
      // and see which view could contain those coordinates
      // to really do it properly
      if (views.length < 2) {
        return null
      }
      return (
        <g
          fill="none"
          stroke="green"
          strokeWidth={5}
          data-testid={
            layoutMatches.length ? `${trackConfigId}-loaded` : trackConfigId
          }
        >
          {layoutMatches.map(chunk => {
            // we follow a path in the list of chunks, not from top to bottom, just in series
            // following x1,y1 -> x2,y2
            const ret = []
            for (let i = 0; i < chunk.length; i += 1) {
              const { layout: c1, feature: f1, level: level1 } = chunk[i]
              const level2 = level1 === 0 ? 1 : 0
              const id = f1.id()
              if (!c1) return null

              const info = f1.get('INFO')
              const chr2 = info.CHR2[0]
              const end2 = info.END[0]
              const [myDirection, mateDirection] = info.STRANDS[0].split('')

              const r = getPxFromCoordinate(views[level2], chr2, end2)
              if (r) {
                const c2: LayoutRecord = [r, 0, r + 1, 0]

                const x1 = getPxFromCoordinate(
                  views[level1],
                  f1.get('refName'),
                  c1[LEFT],
                )
                const x2 = r
                const reversed1 = views[level1].pxToBp(x1).reversed
                const reversed2 = views[level2].pxToBp(x2).reversed

                const tracks = views.map(v => v.getTrack(trackConfigId))
                const y1 = yPos(trackConfigId, level1, views, tracks, c1)
                const y2 = yPos(trackConfigId, level2, views, tracks, c2)

                const path = Path()
                  .moveTo(
                    x1 -
                      20 *
                        (myDirection === '+' ? 1 : -1) *
                        (reversed1 ? -1 : 1),
                    y1,
                  )
                  .lineTo(x1, y1)
                  .lineTo(x2, y2)
                  .lineTo(
                    x2 -
                      20 *
                        (mateDirection === '+' ? 1 : -1) *
                        (reversed2 ? -1 : 1),
                    y2,
                  )
                  .end()
                ret.push(
                  <path
                    d={path}
                    key={JSON.stringify(path)}
                    strokeWidth={id === mouseoverElt ? 10 : 5}
                    onClick={() => {
                      const featureWidget = session.addWidget(
                        'VariantFeatureWidget',
                        'variantFeature',
                        {
                          featureData: (
                            totalFeatures.get(id) || { toJSON: () => {} }
                          ).toJSON(),
                        },
                      )
                      session.showWidget(featureWidget)
                    }}
                    onMouseOver={() => setMouseoverElt(id)}
                    onMouseOut={() => setMouseoverElt(undefined)}
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
