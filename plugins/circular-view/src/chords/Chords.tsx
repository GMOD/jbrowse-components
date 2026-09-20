import { observer } from 'mobx-react'

import Chord from './Chord.tsx'
import { chordPath } from './chordGeometry.ts'

import type { ChordDisplayModel } from './types.ts'

const Chords = observer(function Chords({
  display,
}: {
  display: ChordDisplayModel
}) {
  const {
    features,
    configuration,
    sliceFor,
    radiusPx,
    bezierRadius,
    selectedFeatureId,
    highlightedFeatureIdSet,
    onChordClick,
  } = display
  const sliceForRefName = (refName: string) => sliceFor(undefined, refName)
  return (
    // testid is load-bearing for the embedded-component cypress suites.
    // `cursor` is inherited, so it belongs here rather than repeated on every
    // chord — a whole-genome SV set is tens of thousands of them, and each copy
    // is also a dead attribute in the SVG export
    <g data-testid="structuralVariantChordRenderer" cursor="crosshair">
      {features?.map(feature => {
        const d = chordPath({
          feature,
          sliceFor: sliceForRefName,
          radius: radiusPx,
          bezierRadius,
        })
        return d ? (
          <Chord
            key={feature.id()}
            feature={feature}
            d={d}
            config={configuration}
            selected={selectedFeatureId === feature.id()}
            dimmed={highlightedFeatureIdSet?.has(feature.id()) === false}
            onClick={onChordClick}
          />
        ) : null
      })}
    </g>
  )
})

export default Chords
