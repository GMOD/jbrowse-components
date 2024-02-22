import React, { useMemo } from 'react'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// locals
import Chord, { Block, AnyRegion } from './Chord'

const StructuralVariantChordsReactComponent = observer(function ({
  features,
  config,
  displayModel,
  blockDefinitions,
  radius,
  bezierRadius,
  displayModel: { selectedFeatureId },
  onChordClick,
}: {
  features: Map<string, Feature>
  radius: number
  config: AnyConfigurationModel
  displayModel: { id: string; selectedFeatureId: string }
  blockDefinitions: Block[]
  bezierRadius: number
  onChordClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: unknown,
  ) => void
}) {
  // make a map of refName -> blockDefinition
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
    <g
      id={`chords-${typeof jest !== 'undefined' ? 'test' : displayModel.id}`}
      data-testid="structuralVariantChordRenderer"
    >
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
