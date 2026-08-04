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
    // testid is load-bearing for the embedded-component cypress suites.
    // `cursor` is inherited, so it belongs here rather than repeated on every
    // chord — a whole-genome SV set is tens of thousands of them, and each copy
    // is also a dead attribute in the SVG export
    <g data-testid="structuralVariantChordRenderer" cursor="crosshair">
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
