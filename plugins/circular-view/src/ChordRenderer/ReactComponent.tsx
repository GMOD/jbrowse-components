import { observer } from 'mobx-react'

import Chord from './Chord.tsx'

import type { Block } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

const SVChordsReactComponent = observer(function SVChordsReactComponent({
  features,
  config,
  blocksForRefs,
  radius,
  bezierRadius,
  displayModel,
  onChordClick,
}: {
  features: Feature[]
  radius: number
  config: AnyConfigurationModel
  displayModel: {
    id: string
    selectedFeatureId: string | undefined
  }
  blocksForRefs: Record<string, Block>
  bezierRadius: number
  onChordClick: (feature: Feature) => void
}) {
  const { selectedFeatureId } = displayModel
  return (
    <g data-testid="structuralVariantChordRenderer">
      {features.map(feature => {
        const id = feature.id()
        const selected = selectedFeatureId === id
        return (
          <Chord
            key={id}
            feature={feature}
            config={config}
            radius={radius}
            bezierRadius={bezierRadius}
            blocksForRefs={blocksForRefs}
            selected={selected}
            onClick={onChordClick}
          />
        )
      })}
    </g>
  )
})

export default SVChordsReactComponent
