import React, { lazy, Suspense, useRef, useState } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// local
import { makeFeaturePair, makeSummary } from './util'
import type { LinearArcDisplayModel } from '../model'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ArcTooltip = lazy(() => import('../../ArcTooltip'))

type LGV = LinearGenomeViewModel

const Arc = observer(function ({
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
  session: AbstractSessionModel
  view: LinearGenomeViewModel
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { height } = model
  const { k1, k2 } = makeFeaturePair(feature, alt)
  const ref = useRef<SVGPathElement>(null)
  const c = getConf(model, 'color', { feature, alt })
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
    const col = mouseOvered ? 'black' : c
    const sw = 3

    return absrad > 1 ? (
      <>
        <path
          d={`M ${left} 0 C ${left} ${destY}, ${right} ${destY}, ${right} 0`}
          ref={ref}
          {...getStrokeProps(col)}
          strokeWidth={sw}
          onMouseOut={() => {
            setMouseOvered(false)
          }}
          onMouseOver={() => {
            setMouseOvered(true)
          }}
          onClick={() => {
            model.selectFeature(feature)
          }}
          fill="none"
          pointerEvents="stroke"
        />
        {k1.mateDirection ? (
          <line
            {...getStrokeProps(col)}
            strokeWidth={sw}
            onMouseOut={() => {
              setMouseOvered(false)
            }}
            onMouseOver={() => {
              setMouseOvered(true)
            }}
            onClick={() => {
              model.selectFeature(feature)
            }}
            x1={left}
            x2={left + k1.mateDirection * 20}
            y1={1.5}
            y2={1.5}
          />
        ) : null}
        {k2.mateDirection ? (
          <line
            {...getStrokeProps(col)}
            strokeWidth={sw}
            onMouseOut={() => {
              setMouseOvered(false)
            }}
            onMouseOver={() => {
              setMouseOvered(true)
            }}
            onClick={() => {
              model.selectFeature(feature)
            }}
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

const Wrapper = observer(function ({
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
    children
  ) : (
    <svg width={width} height={height}>
      {children}
    </svg>
  )
})

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
  const assembly = assemblyManager.get(view.assemblyNames[0]!)

  return assembly ? (
    <Wrapper model={model} exportSVG={exportSVG}>
      {features?.map(f => {
        const alts = f.get('ALT') as string[] | undefined
        return (
          alts?.map(a => (
            <Arc
              key={`${f.id()}-${a}`}
              session={session}
              feature={f}
              alt={a}
              view={view}
              model={model}
              assembly={assembly}
            />
          )) ?? (
            <Arc
              key={f.id()}
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
