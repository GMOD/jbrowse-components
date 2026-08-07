import { TrackColorsMixin } from './TrackColorsMixin.ts'

import type { AttributeRange } from './colorRamps.ts'

// The floating legend is one box for the whole view, so the domain it labels an
// `attribute:<column>` ramp with has to be one answer for every loaded display.
// A per-display answer is what makes that one legend lie.
function viewWith(loaded: Record<string, AttributeRange>[]) {
  return TrackColorsMixin()
    .views(() => ({
      loadedAttributeRanges() {
        return loaded
      },
    }))
    .create({})
}

describe('attributeRanges', () => {
  it('is empty before any display has loaded', () => {
    // an attribute mode resolves to a flat 0..0 domain on this, which is the
    // documented no-data answer rather than a NaN ramp
    expect(viewWith([]).attributeRanges).toEqual({})
  })

  it('passes a single display through unchanged', () => {
    expect(viewWith([{ dn: { min: 0, max: 2 } }]).attributeRanges).toEqual({
      dn: { min: 0, max: 2 },
    })
  })

  it('unions the span of a column two displays both carry', () => {
    // the case the getter exists for: labelling the shared ramp from either
    // display alone understates it, and the ribbons of the other one then paint
    // past the end of the domain the legend claims
    expect(
      viewWith([{ dn: { min: 0.5, max: 2 } }, { dn: { min: 0.1, max: 9 } }])
        .attributeRanges,
    ).toEqual({ dn: { min: 0.1, max: 9 } })
  })

  it('keeps a column only one display carries', () => {
    expect(
      viewWith([{ dn: { min: 1, max: 2 } }, { goc: { min: 30, max: 100 } }])
        .attributeRanges,
    ).toEqual({ dn: { min: 1, max: 2 }, goc: { min: 30, max: 100 } })
  })

  it('ignores a display that loaded no attributes at all', () => {
    // a display still fetching, or a track declaring no numeric columns
    expect(
      viewWith([{}, { dn: { min: 1, max: 2 } }, {}]).attributeRanges,
    ).toEqual({ dn: { min: 1, max: 2 } })
  })
})
