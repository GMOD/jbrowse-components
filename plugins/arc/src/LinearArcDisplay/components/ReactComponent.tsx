import React from 'react'
import { observer } from 'mobx-react'
import { Feature, getContainingView, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { readConfObject } from '@jbrowse/core/configuration'

// local
import { LinearArcDisplayModel } from '../model'
import BaseDisplayComponent from './BaseDisplayComponent'

type LGV = LinearGenomeViewModel

const Arc = observer(function ({
  model,
  feature,
  assembly,
  view,
}: {
  feature: Feature
  model: LinearArcDisplayModel
  assembly: Assembly
  view: LinearGenomeViewModel
}) {
  const { height, rendererConfig } = model
  const k1 = {
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand: feature.get('strand'),
  }
  const c = readConfObject(rendererConfig, 'color', { feature })
  const k2 = feature.get('mate')
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
        stroke={c}
        strokeWidth={2}
        fill="transparent"
        pointerEvents="stroke"
      />
    )
  }
  return null
})
const Arcs = observer(function ({ model }: { model: LinearArcDisplayModel }) {
  const view = getContainingView(model) as LGV
  const { assemblyManager } = getSession(model)
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const { height, features } = model
  const assembly = assemblyManager.get(view.assemblyNames[0])

  return assembly ? (
    <svg
      data-testid="arc-svg-canvas"
      style={{ width, height, position: 'absolute' }}
      width={width * 2}
      height={height * 2}
    >
      {features?.map(f => (
        <Arc
          key={f.id()}
          feature={f}
          view={view}
          model={model}
          assembly={assembly}
        />
      ))}
    </svg>
  ) : null
})

const LinearArcReactComponent = observer(function ({
  model,
}: {
  model: LinearArcDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Arcs model={model} />
    </BaseDisplayComponent>
  )
})

export default LinearArcReactComponent
