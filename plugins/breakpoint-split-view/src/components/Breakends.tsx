import React, { useState } from 'react'
import Path from 'svg-path-generator'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { parseBreakend, Breakend } from '@gmod/vcf'

// locals
import { yPos, getPxFromCoordinate, useNextFrame } from '../util'
import { BreakpointViewModel } from '../model'

const [LEFT] = [0, 1, 2, 3]

function findMatchingAlt(feat1: Feature, feat2: Feature) {
  const candidates: Record<string, Breakend> = {}
  const alts = feat1.get('ALT') as string[] | undefined
  alts
    ?.map(alt => parseBreakend(alt))
    .filter((f): f is Breakend => !!f)
    .forEach(bnd => (candidates[bnd.MatePosition] = bnd))

  return candidates[`${feat2.get('refName')}:${feat2.get('start') + 1}`]
}

const Breakends = observer(
  ({
    model,
    trackConfigId,
    parentRef: ref,
  }: {
    model: BreakpointViewModel
    trackConfigId: string
    parentRef: React.RefObject<SVGSVGElement>
  }) => {
    const { views } = model
    const session = getSession(model)
    const { assemblyManager } = session

    const totalFeatures = model.getTrackFeatures(trackConfigId)
    const features = model.getMatchedBreakendFeatures(trackConfigId)
    const layoutMatches = model.getMatchedFeaturesInLayout(
      trackConfigId,
      features,
    )
    const [mouseoverElt, setMouseoverElt] = useState<string>()
    const snap = getSnapshot(model)
    useNextFrame(snap)
    const assembly = assemblyManager.get(views[0].assemblyNames[0])

    if (!assembly) {
      return null
    }

    let yoff = 0
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      yoff = rect.top
    }

    return (
      <g
        stroke="green"
        strokeWidth={5}
        fill="none"
        data-testid={
          layoutMatches.length ? `${trackConfigId}-loaded` : trackConfigId
        }
      >
        {layoutMatches.map(chunk => {
          const ret = []
          // we follow a path in the list of chunks, not from top to bottom, just
          // in series following x1,y1 -> x2,y2
          for (let i = 0; i < chunk.length - 1; i += 1) {
            const { layout: c1, feature: f1, level: level1 } = chunk[i]
            const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]
            const id = f1.id()

            const relevantAlt = findMatchingAlt(f1, f2)
            if (!c1 || !c2) {
              return null
            }
            const f1origref = f1.get('refName')
            const f2origref = f2.get('refName')
            const f1ref = assembly.getCanonicalRefName(f1origref)
            const f2ref = assembly.getCanonicalRefName(f2origref)
            if (!f1ref || !f2ref) {
              throw new Error(`unable to find ref for ${f1ref || f2ref}`)
            }
            const x1 = getPxFromCoordinate(views[level1], f1ref, c1[LEFT])
            const x2 = getPxFromCoordinate(views[level2], f2ref, c2[LEFT])
            const reversed1 = views[level1].pxToBp(x1).reversed
            const reversed2 = views[level2].pxToBp(x2).reversed

            const tracks = views.map(v => v.getTrack(trackConfigId))
            const y1 = yPos(trackConfigId, level1, views, tracks, c1) - yoff
            const y2 = yPos(trackConfigId, level2, views, tracks, c2) - yoff
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
                      (reversed1 ? -1 : 1),
                  y1,
                )
                .lineTo(x1, y1)
                .lineTo(x2, y2)
                .lineTo(
                  x2 -
                    20 *
                      (relevantAlt.MateDirection === 'left' ? 1 : -1) *
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
                    const featureWidget = session.addWidget?.(
                      'VariantFeatureWidget',
                      'variantFeature',
                      {
                        featureData: totalFeatures.get(id),
                      },
                    )
                    session.showWidget?.(featureWidget)
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

export default Breakends
