/* eslint-disable  no-nested-ternary */
import {
  PafRecord,
  LinearSyntenyViewModel,
  AnchorsData,
  SimpleAnchorsData,
} from '../model'
import { yPos, getPxFromCoordinate, cheight } from '../util'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState, useEffect } = jbrequire('react')

  return observer(
    ({
      model,
      height,
      syntenyGroup,
    }: {
      model: LinearSyntenyViewModel
      height: number
      syntenyGroup: string
    }) => {
      const { views, showIntraviewLinks } = model
      const [initialized, setInitialized] = useState(false)
      const simpleAnchors = getConf(model, 'simpleAnchors')
      const anchors = getConf(model, 'anchors')
      const pafData = getConf(model, 'paf')
      useEffect(() => {
        ;(async () => {
          if (simpleAnchors) {
            const data = await fetch(simpleAnchors)
            const text = await data.text()
            const m: { [key: string]: number } = {}
            const r: SimpleAnchorsData = {}
            text.split('\n').forEach((line: string, index: number) => {
              if (line.length) {
                if (line !== '###') {
                  const [name1, name2, name3, name4, score] = line.split('\t')
                  m[name1] = index
                  m[name2] = index
                  m[name3] = index
                  m[name4] = index
                  r[index] = { name1, name2, name3, name4, score: +score }
                }
              }
            })

            model.setSimpleAnchorsData(m, r)
            setInitialized(true)
          }
          if (anchors) {
            const data = await fetch(anchors)
            const text = await data.text()
            const m: { [key: string]: number } = {}
            const r: AnchorsData = {}

            text.split('\n').forEach((line: string, index: number) => {
              if (line.length) {
                const [name1, name2, score] = line.split('\t')
                m[name1] = index
                m[name2] = index
                r[index] = { name1, name2, score: +score }
              }
            })

            model.setAnchorsData(m, r)
            setInitialized(true)
          }
          if (pafData) {
            const data = await fetch(pafData)
            const text = await data.text()
            const m: PafRecord[] = []
            text.split('\n').forEach((line: string, index: number) => {
              if (line.length) {
                const [
                  chr1,
                  ,
                  start1,
                  end1,
                  strand1,
                  chr2,
                  ,
                  start2,
                  end2,
                ] = line.split('\t')
                m[index] = {
                  chr1,
                  start1: +start1,
                  end1: +end1,
                  strand1,
                  chr2,
                  start2: +start2,
                  end2: +end2,
                }
              }
            })

            model.setMinimap2Data(m)
            setInitialized(true)
          }
        })()
      }, [anchors, model, pafData, simpleAnchors])

      if (!initialized) return null

      const layoutMatches = anchors
        ? model.allMatchedAnchorFeatures[syntenyGroup]
        : simpleAnchors
        ? model.allMatchedSimpleAnchorFeatures[syntenyGroup]
        : pafData
        ? model.minimap2Features
        : model.getMatchedFeaturesInLayout(
            syntenyGroup,
            model.allMatchedSyntenyFeatures[syntenyGroup],
          )

      const middle = getConf(model, 'middle')
      const hideTiny = getConf(model, 'hideTiny')
      if (!layoutMatches) {
        return null
      }

      return (
        <g
          stroke="#333"
          fill="none"
          data-testid={
            layoutMatches.length ? `synteny-view-loaded` : 'synteny-view'
          }
        >
          {layoutMatches.map(chunk => {
            const ret = []
            // we follow a path in the list of chunks, not from top to bottom, just in series
            // following x1,y1 -> x2,y2
            for (let i = 0; i < chunk.length - 1; i += 1) {
              const {
                layout: c1,
                feature: f1,
                level: level1,
                refName: refName1,
              } = chunk[i]
              const {
                layout: c2,
                feature: f2,
                level: level2,
                refName: refName2,
              } = chunk[i + 1]

              if (!c1 || !c2) {
                console.warn('received null layout for a overlay feature')
                return null
              }

              // disable rendering connections in a single level
              if (!showIntraviewLinks && level1 === level2) {
                return null
              }
              const r1 = refName1
              const r2 = refName2
              const l1 = f1.get('end') - f1.get('start')
              const l2 = f2.get('end') - f2.get('start')

              if (
                (hideTiny && l1 < views[level1].bpPerPx) ||
                l2 < views[level2].bpPerPx
              ) {
                // eslint-disable-next-line no-continue
                continue
              }
              //  eslint-disable-next-line no-continue
              if (!model.refNames[level1].includes(r1)) continue
              //   eslint-disable-next-line no-continue
              if (!model.refNames[level2].includes(r2)) continue

              const x11 = getPxFromCoordinate(views[level1], r1, c1[LEFT])
              const x12 = getPxFromCoordinate(views[level1], r1, c1[RIGHT])
              const x21 = getPxFromCoordinate(views[level2], r2, c2[LEFT])
              const x22 = getPxFromCoordinate(views[level2], r2, c2[RIGHT])

              const tracks = views.map(view => ({
                view,
                track: model.getSyntenyTrackFromView(view, syntenyGroup),
              }))
              const nv = tracks.map(v => v.view)
              const nt = tracks.map(v => v.track)
              const nc = tracks.filter(f => !!f.track)

              const y1 = middle
                ? 0
                : yPos(getConf(nc[0].track, 'trackId'), level1, nv, nt, c1) +
                  (level1 < level2 ? cheight(c1) : 0)
              const y2 = middle
                ? 150
                : yPos(getConf(nc[1].track, 'trackId'), level2, nv, nt, c2) +
                  (level2 < level1 ? cheight(c2) : 0)

              ret.push(
                <polygon
                  key={`${f1.id()}-${f2.id()}`}
                  points={`${x11},${y1} ${x12},${y1} ${x22},${y2}, ${x21},${y2}`}
                  style={{ fill: 'rgba(255,100,100,0.3)' }}
                />,
              )
            }
            return ret
          })}
        </g>
      )
    },
  )
}
