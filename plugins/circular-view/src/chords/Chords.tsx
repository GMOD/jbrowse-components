import { observer } from 'mobx-react'

import Chord from './Chord.tsx'

import type { ChordDisplayModel } from './types.ts'

const Chords = observer(function Chords({
  display,
}: {
  display: ChordDisplayModel
}) {
  const {
    features,
    configuration,
    blocksForRefs,
    radiusPx,
    bezierRadius,
    selectedFeatureId,
    onChordClick,
  } = display
  return (
    // testid is load-bearing for the embedded-component cypress suites
    <g data-testid="structuralVariantChordRenderer">
      {features?.map(feature => (
        <Chord
          key={feature.id()}
          feature={feature}
          config={configuration}
          radius={radiusPx}
          bezierRadius={bezierRadius}
          blocksForRefs={blocksForRefs}
          selected={selectedFeatureId === feature.id()}
          onClick={onChordClick}
        />
      ))}
    </g>
  )
})

export default Chords
