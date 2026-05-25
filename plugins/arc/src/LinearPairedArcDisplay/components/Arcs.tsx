import { Suspense, lazy, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { makeFeaturePair, makeSummary } from './util.ts'

import type { LinearArcDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ArcTooltip = lazy(() => import('../../ArcTooltip.tsx'))

type LGV = LinearGenomeViewModel

const Arc = observer(function Arc({
  model,
  feature,
  alt,
  assembly,
  view,
}: {
  feature: Feature
  alt?: string
  model: LinearArcDisplayModel
  assembly: Assembly
  view: LinearGenomeViewModel
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { height } = model
  const { k1, k2 } = makeFeaturePair(feature, alt)
  const c = getConf(model, 'color', { feature, alt })
  const ra1 = assembly.getCanonicalRefName(k1.refName) || k1.refName
  const ra2 = assembly.getCanonicalRefName(k2.refName) || k2.refName
  const r1 = view.bpToPx({ refName: ra1, coord: k1.start })?.offsetPx
  const r2 = view.bpToPx({ refName: ra2, coord: k2.start })?.offsetPx

  if (r1 !== undefined && r2 !== undefined) {
    const left = r1 - view.offsetPx
    const right = r2 - view.offsetPx
    const absrad = Math.abs((right - left) / 2)
    const destY = Math.min(height, absrad)
    const col = mouseOvered ? 'black' : c
    const events = {
      onMouseOut: () => {
        setMouseOvered(false)
      },
      onMouseOver: () => {
        setMouseOvered(true)
      },
      onClick: () => {
        model.selectFeature(feature)
      },
    }

    return absrad > 1 ? (
      <>
        <path
          d={`M ${left} 0 C ${left} ${destY}, ${right} ${destY}, ${right} 0`}
          {...getStrokeProps(col)}
          strokeWidth={3}
          {...events}
          fill="none"
          pointerEvents="stroke"
        />
        {k1.mateDirection ? (
          <line
            {...getStrokeProps(col)}
            strokeWidth={3}
            {...events}
            x1={left}
            x2={left + k1.mateDirection * 20}
            y1={1.5}
            y2={1.5}
          />
        ) : null}
        {k2.mateDirection ? (
          <line
            {...getStrokeProps(col)}
            strokeWidth={3}
            {...events}
            x1={right}
            x2={right + k2.mateDirection * 20}
            y1={1.5}
            y2={1.5}
          />
        ) : null}
        {mouseOvered ? (
          <Suspense fallback={null}>
            <ArcTooltip contents={makeSummary(feature, alt)} />
          </Suspense>
        ) : null}
      </>
    ) : null
  }
  return null
})

const Wrapper = observer(function Wrapper({
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
  const width = view.totalWidthPx
  return exportSVG ? (
    children
  ) : (
    <svg width={width} height={height}>
      {children}
    </svg>
  )
})

const Arcs = observer(function Arcs({
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
  const assembly = assemblyManager.get(view.assemblyNames[0]!)

  return assembly ? (
    <Wrapper model={model} exportSVG={exportSVG}>
      {features?.map(f => {
        const alts = f.get('ALT') as string[] | undefined
        return (
          alts?.map(a => (
            <Arc
              key={`${f.id()}-${a}`}
              feature={f}
              alt={a}
              view={view}
              model={model}
              assembly={assembly}
            />
          )) ?? (
            <Arc
              key={f.id()}
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
