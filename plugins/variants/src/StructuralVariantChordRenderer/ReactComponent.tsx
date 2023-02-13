import React, { useMemo } from 'react'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// locals
import Chord, { Block, AnyRegion } from './Chord'

export default observer(function StructuralVariantChords({
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
    const blocksForRefs = {} as { [key: string]: Block }
    blockDefinitions.forEach(block => {
      ;(block.region.elided ? block.region.regions : [block.region]).forEach(
        r => (blocksForRefs[r.refName] = block),
      )
    })
    return blocksForRefs
  }, [blockDefinitions])
  const chords = []
  for (const feature of features.values()) {
    const id = feature.id()
    const selected = String(selectedFeatureId) === String(id)
    chords.push(
      <Chord
        key={id}
        feature={feature}
        config={config}
        radius={radius}
        bezierRadius={bezierRadius}
        blocksForRefs={blocksForRefsMemo}
        selected={selected}
        onClick={onChordClick}
      />,
    )
  }
  const trackStyleId = `chords-${
    typeof jest !== 'undefined' ? 'test' : displayModel.id
  }`
  return (
    <g id={trackStyleId} data-testid="structuralVariantChordRenderer">
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
          #${trackStyleId} > path {
            cursor: crosshair;
            fill: none;
          }
`,
        }}
      />
      {chords}
    </g>
  )
})
