import { useState } from 'react'

import { SingleSlider, sliderScale } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'

const { toSlider, fromSlider, sliderStep } = sliderScale('log')

// What the "Min length" row says in both comparative views, so the two cannot
// describe the same control differently.
//
// The second sentence is the one that earns its place. `buildSyntenyGeometry`
// filters each drawn block by its OWN span and deliberately cannot group blocks
// that share a name — a BAM read's QNAME is shared across its supplementary
// alignments, and summing those would keep a read whose pieces are each tiny
// while hiding a substantial single block. The visible consequence is on the
// coarse LOD tier, where make-pif has split a long alignment on its large
// indels: the pieces are filtered as the separate blocks they are, so crossing
// the tier threshold with this set can hide an alignment the fine tier shows.
export const MIN_LENGTH_HELP =
  'Hides alignments shorter than this many bp. Cuts whole-genome hairball ' +
  'noise from short/spurious chains. Each drawn block is measured by its own ' +
  'span, never grouped with others of the same name — so a level-of-detail ' +
  'tier that splits a long alignment on its large indels is filtered piece by ' +
  'piece.'

// Log2-scaled slider for minimum alignment length in bp. Drag state is held
// locally in slider space; the model is only updated on commit so dragging
// doesn't refetch.
export default function MinLengthSlider({
  value,
  onCommit,
  maxBp = 1_000_000,
}: {
  value: number
  onCommit: (bp: number) => void
  maxBp?: number
}) {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const sliderValue = dragValue ?? toSlider(value)
  return (
    <SingleSlider
      value={sliderValue}
      onChange={v => {
        setDragValue(v)
      }}
      onChangeCommitted={v => {
        setDragValue(null)
        onCommit(fromSlider(v))
      }}
      min={0}
      max={toSlider(maxBp)}
      step={sliderStep}
      valueLabelDisplay="auto"
      valueLabelFormat={v => toLocale(fromSlider(v))}
      size="small"
    />
  )
}
