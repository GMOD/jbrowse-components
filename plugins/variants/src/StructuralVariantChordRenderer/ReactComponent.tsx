import React, { useMemo } from 'react'
import { observer } from 'mobx-react'
import Chord from './Chord'
import type { Block, AnyRegion } from './Chord'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// locals
import type { Feature } from '@jbrowse/core/util'

const StructuralVariantChordsReactComponent = observer(function ({
  features,
  config,
  blockDefinitions,
  radius,
  bezierRadius,
  displayModel,
  onChordClick,
}: {
  features: Map<string, Feature>
  radius: number
  config: AnyConfigurationModel
  displayModel?: {
    id: string
    selectedFeatureId: string
  }
  blockDefinitions: Block[]
  bezierRadius: number
  onChordClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: unknown,
  ) => void
}) {
  const { selectedFeatureId } = displayModel || {}
  const blocksForRefsMemo = useMemo(() => {
    const blocksForRefs = {} as Record<string, Block>
    for (const block of blockDefinitions) {
      const regions = block.region.elided
        ? block.region.regions
        : [block.region]
      for (const region of regions) {
        blocksForRefs[region.refName] = block
      }
    }
    return blocksForRefs
  }, [blockDefinitions])

  return (
    <g data-testid="structuralVariantChordRenderer">
      {[...features.values()].map(feature => {
        const id = feature.id()
        const selected = String(selectedFeatureId) === String(id)
        return (
          <Chord
            key={id}
            feature={feature}
            config={config}
            radius={radius}
            bezierRadius={bezierRadius}
            blocksForRefs={blocksForRefsMemo}
            selected={selected}
            onClick={onChordClick}
          />
        )
      })}
    </g>
  )
})

export default StructuralVariantChordsReactComponent
