import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getFillProps } from '@jbrowse/core/util'
import { getMate } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { ribbonPath } from './ribbonGeometry.ts'
import { ribbonLabel } from './ribbonLabel.ts'
import { DIMMED_OPACITY } from './types.ts'

import type { RibbonDisplayModel } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

const Ribbon = observer(function Ribbon({
  feature,
  sliceFor,
  radius,
  config,
  restingFill,
  bezierRadius,
  selected,
  dimmed,
  onClick,
}: {
  feature: Feature
  sliceFor: RibbonDisplayModel['sliceFor']
  radius: number
  config: AnyConfigurationModel
  restingFill: RibbonDisplayModel['ribbonFill']
  bezierRadius: number
  selected: boolean
  dimmed: boolean
  onClick: (feat: Feature) => void
}) {
  const [hovered, setHovered] = useState(false)
  const mate = getMate(feature)
  const anchorBlock = sliceFor(
    feature.get('assemblyName') as string | undefined,
    feature.get('refName'),
  )
  const mateBlock = mate ? sliceFor(mate.assemblyName, mate.refName) : undefined
  if (!anchorBlock || !mateBlock || !mate) {
    return null
  }
  const fill =
    hovered || selected
      ? readConfObject(config, hovered ? 'colorHover' : 'colorSelected', {
          feature,
        })
      : restingFill(feature)
  return (
    <path
      data-testid={`ribbon-${feature.id()}`}
      d={ribbonPath({
        anchor: {
          block: anchorBlock,
          start: feature.get('start'),
          end: feature.get('end'),
        },
        mate: { block: mateBlock, start: mate.start, end: mate.end },
        strand: feature.get('strand') ?? 1,
        radius,
        bezierRadius,
      })}
      {...getFillProps(fill)}
      opacity={dimmed && !hovered ? DIMMED_OPACITY : undefined}
      onClick={() => {
        onClick(feature)
      }}
      onPointerEnter={() => {
        setHovered(true)
      }}
      onPointerLeave={() => {
        setHovered(false)
      }}
    >
      <title>{ribbonLabel(feature)}</title>
    </path>
  )
})

export default Ribbon
