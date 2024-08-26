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
  onChordClick,
}: {
  features: Map<string, Feature>
  radius: number
  config: AnyConfigurationModel
  displayModel?: { id: string; selectedFeatureId: string }
  blockDefinitions: Block[]
  bezierRadius: number
  onChordClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: unknown,
  ) => void
}) {
  const { id, selectedFeatureId } = displayModel || {}
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
    <g data-testid="structuralVariantChordRenderer">
      {[...features.values()].map(feature => (
        <Chord
          key={feature.id()}
          feature={feature}
          config={config}
          radius={radius}
          bezierRadius={bezierRadius}
          blocksForRefs={blocksForRefsMemo}
          selected={String(selectedFeatureId) === String(id)}
          onClick={onChordClick}
        />
      ))}
    </g>
  )
})

export default StructuralVariantChordsReactComponent
