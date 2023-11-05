import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  AbstractSessionModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { readConfObject } from '@jbrowse/core/configuration'
import { parseBreakend } from '@gmod/vcf'

// local
import { LinearArcDisplayModel } from '../model'

type LGV = LinearGenomeViewModel

function f(feature: Feature, alt?: string) {
  const bnd = alt ? parseBreakend(alt) : undefined
  let start = feature.get('start')
  let end = feature.get('end')
  const strand = feature.get('strand')
  const mate = feature.get('mate')
  const refName = feature.get('refName')

  let mateRefName: string | undefined
  let mateEnd = 0
  let mateStart = 0

  // one sided bracket used, because there could be <INS:ME> and we just check
  // startswith below
  const symbolicAlleles = ['<TRA', '<DEL', '<INV', '<INS', '<DUP', '<CNV']
  if (symbolicAlleles.some(a => alt?.startsWith(a))) {
    // END is defined to be a single value, not an array. CHR2 not defined in
    // VCF spec, but should be similar
    const e = feature.get('INFO')?.END || feature.get('end')
    mateEnd = e
    mateStart = e - 1
    mateRefName = feature.get('INFO')?.CHR2 ?? refName
    // re-adjust the arc to be from start to end of feature
    start = feature.get('start')
    end = feature.get('start') + 1
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    mateEnd = +matePosition[1]
    mateStart = +matePosition[1] - 1
    mateRefName = matePosition[0]
  }

  return {
    k1: { refName, start, end, strand },
    k2: mate ?? { refName: mateRefName, end: mateEnd, start: mateStart },
  }
}

const Arc = observer(function ({
  model,
  feature,
  alt,
  assembly,
  session,
  view,
}: {
  feature: Feature
  alt?: string
  end?: number
  chr2?: string
  model: LinearArcDisplayModel
  assembly: Assembly
  session: AbstractSessionModel
  view: LinearGenomeViewModel
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { selection } = session
  const { height, rendererConfig } = model
  const { k1, k2 } = f(feature, alt)
  const c =
    // @ts-expect-error
    selection?.id?.() === feature.id()
      ? 'red'
      : readConfObject(rendererConfig, 'color', { feature })
  const ra1 = assembly.getCanonicalRefName(k1.refName) || k1.refName
  const ra2 = assembly.getCanonicalRefName(k2.refName) || k2.refName
  const p1 = k1.start
  const p2 = k2.start
  const r1 = view.bpToPx({ refName: ra1, coord: p1 })?.offsetPx
  const r2 = view.bpToPx({ refName: ra2, coord: p2 })?.offsetPx

  if (r1 !== undefined && r2 !== undefined) {
    const radius = (r2 - r1) / 2
    const absrad = Math.abs(radius)
    const destY = Math.min(height, absrad)
    const p1 = r1 - view.offsetPx
    const p2 = r2 - view.offsetPx
    const left = p1
    const right = p2

    return (
      <path
        d={`M ${left} 0 C ${left} ${destY}, ${right} ${destY}, ${right} 0`}
        stroke={mouseOvered ? 'green' : c}
        strokeWidth={2}
        onMouseOut={() => setMouseOvered(false)}
        onMouseOver={() => setMouseOvered(true)}
        onClick={() => model.selectFeature(feature)}
        fill="transparent"
        pointerEvents="stroke"
      />
    )
  }
  return null
})

function Wrapper({
  model,
  exportSVG,
  children,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
  children: React.ReactNode
}) {
  const { height } = model
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  return exportSVG ? (
    <>{children}</>
  ) : (
    <svg
      data-testid="arc-svg-canvas"
      style={{ width, height, position: 'absolute' }}
      width={width * 2}
      height={height * 2}
    >
      {children}
    </svg>
  )
}
const Arcs = observer(function ({
  model,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
}) {
  const view = getContainingView(model) as LGV
  const session = getSession(model)
  const { assemblyManager } = session
  const { features } = model
  const assembly = assemblyManager.get(view.assemblyNames[0])

  return assembly ? (
    <Wrapper model={model} exportSVG={exportSVG}>
      {features?.map(f => {
        const alts = f.get('ALT') as string[] | undefined
        const ends = f.get('INFO')?.END as number[] | undefined
        const chr2s = f.get('INFO')?.CHR2 as string[] | undefined
        return (
          alts?.map((a, i) => (
            <Arc
              key={f.id() + '-' + a}
              session={session}
              feature={f}
              alt={a}
              end={ends?.[i]}
              chr2={chr2s?.[i]}
              view={view}
              model={model}
              assembly={assembly}
            />
          )) ?? (
            <Arc
              session={session}
              feature={f}
              view={view}
              model={model}
              assembly={assembly}
            />
          )
        )
      })}
    </Wrapper>
  ) : null
})

export default Arcs
