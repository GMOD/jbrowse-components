import { displayCanShowCigar, navigationMenuItems } from './menus.ts'

describe('navigationMenuItems', () => {
  function build() {
    const calls: string[] = []
    const items = navigationMenuItems({
      canSquareView: true,
      squareView: () => calls.push('square'),
      showAllRegions: () => calls.push('whole'),
    })
    return { items, calls }
  }

  test('one Show whole genome row, then Square view', () => {
    const { items } = build()
    expect(items.map(i => ('label' in i ? i.label : ''))).toEqual([
      'Show whole genome',
      'Square view - same bp per pixel',
    ])
  })

  // a radio, a checkbox or a submenu here is a mode, and modes live in the
  // header and the settings menu
  test('both rows are plain actions', () => {
    const { items, calls } = build()
    for (const item of items) {
      expect(item).not.toHaveProperty('type')
      expect(item).not.toHaveProperty('subMenu')
      if ('onClick' in item) {
        item.onClick()
      }
    }
    expect(calls).toEqual(['whole', 'square'])
  })
})

// The CIGAR control is gated on data, not config, so that a CIGAR-less PAF
// doesn't offer an inert row. The trap is that "the tier I'm holding has no CIGARs"
// and "this file has no CIGARs" look identical at the point of the gate.
describe('displayCanShowCigar', () => {
  test('a display that has not fetched yet is a maybe', () => {
    // optimistic, so the row is present from the first render rather than
    // popping in once data lands
    expect(displayCanShowCigar({ lodTier: 'fine' })).toBe(true)
    expect(displayCanShowCigar({ lodTier: 'coarse' })).toBe(true)
  })

  test('a loaded fine tier answers from its features', () => {
    expect(
      displayCanShowCigar({ lodTier: 'fine', featureData: { hasCigar: true } }),
    ).toBe(true)
    // a CIGAR-less PAF: nothing for the control to switch between
    expect(
      displayCanShowCigar({
        lodTier: 'fine',
        featureData: { hasCigar: false },
      }),
    ).toBe(false)
  })

  test('a loaded coarse tier stays a maybe despite reporting no CIGARs', () => {
    // The coarse PIF tier omits CIGARs by construction, so hasCigar is false
    // for a file that has them in its fine tier. Answering false here retracted
    // the CIGAR row on zoom-out and restored it on zoom-in — the LOD switch
    // made a setting appear and disappear under the user.
    expect(
      displayCanShowCigar({
        lodTier: 'coarse',
        featureData: { hasCigar: false },
      }),
    ).toBe(true)
  })
})
