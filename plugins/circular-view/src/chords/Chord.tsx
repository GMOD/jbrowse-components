import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { chordLabel } from './chordLabel.ts'
import { DIMMED_OPACITY } from './types.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

const Chord = observer(function Chord({
  feature,
  d,
  config,
  selected,
  dimmed,
  onClick,
}: {
  feature: Feature
  d: string
  config: AnyConfigurationModel
  selected: boolean
  dimmed: boolean
  onClick: (feat: Feature) => void
}) {
  const [hovered, setHovered] = useState(false)
  const stroke = readConfObject(
    config,
    hovered
      ? 'strokeColorHover'
      : selected
        ? 'strokeColorSelected'
        : 'strokeColor',
    { feature },
  )
  return (
    <path
      data-testid={`chord-${feature.id()}`}
      fill="none"
      d={d}
      {...getStrokeProps(stroke)}
      strokeWidth={hovered ? 3 : 1}
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
      <title>{chordLabel(feature)}</title>
    </path>
  )
})

export default Chord
