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

// A fetch reports the span of the window it holds, so painting off that alone
// re-maps every ribbon onto the ramp each time a pan rolls the window over.
describe('the domain accumulated across fetches', () => {
  it('holds the span a pan has left behind', () => {
    const loaded = [{ dn: { min: 0, max: 2 } }]
    const view = viewWith(loaded)
    view.observeAttributeRanges(loaded[0]!)
    loaded[0] = { dn: { min: 8, max: 9 } }
    view.observeAttributeRanges(loaded[0])
    expect(view.attributeRanges).toEqual({ dn: { min: 0, max: 9 } })
  })

  // The identity, not just the value: this is read through a computed on every
  // recolor, and a fresh object per fetch that said nothing new would re-run
  // every color pass and re-upload every instance buffer behind it.
  it('is the SAME OBJECT after a fetch that says nothing new', () => {
    const view = viewWith([])
    view.observeAttributeRanges({ dn: { min: 0, max: 2 } })
    const first = view.seenAttributeRanges
    view.observeAttributeRanges({ dn: { min: 0.5, max: 1 } })
    expect(view.seenAttributeRanges).toBe(first)
  })

  it('and reading it past a loaded span already inside it allocates nothing', () => {
    const view = viewWith([{ dn: { min: 0.5, max: 1 } }])
    view.observeAttributeRanges({ dn: { min: 0, max: 2 } })
    expect(view.attributeRanges).toBe(view.seenAttributeRanges)
  })

  // The way back. One window holding an outlier would otherwise compress the
  // ramp for the rest of the session, and the union is over the LOADED spans —
  // so the rescale lands without waiting for a refetch.
  it('is dropped by picking a mode, rescaling to what is loaded', () => {
    const view = viewWith([{ dn: { min: 0, max: 1 } }])
    view.observeAttributeRanges({ dn: { min: 0, max: 900 } })
    expect(view.attributeRanges).toEqual({ dn: { min: 0, max: 900 } })
    view.setColorBy('attribute:dn')
    expect(view.attributeRanges).toEqual({ dn: { min: 0, max: 1 } })
  })
})
