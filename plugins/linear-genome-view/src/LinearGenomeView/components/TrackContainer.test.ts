import { shouldSwapTracks } from './TrackContainer'

describe('shouldSwapTracks', () => {
  it('allows first swap when lastSwapY is undefined', () => {
    expect(shouldSwapTracks(undefined, 100, true)).toBe(true)
    expect(shouldSwapTracks(undefined, 100, false)).toBe(true)
  })

  it('prevents swap without enough movement when moving down', () => {
    expect(shouldSwapTracks(100, 110, true)).toBe(false)
    expect(shouldSwapTracks(100, 129, true)).toBe(false)
  })

  it('allows swap after moving enough distance down', () => {
    expect(shouldSwapTracks(100, 131, true)).toBe(true)
    expect(shouldSwapTracks(100, 200, true)).toBe(true)
  })

  it('prevents swap without enough movement when moving up', () => {
    expect(shouldSwapTracks(100, 90, false)).toBe(false)
    expect(shouldSwapTracks(100, 71, false)).toBe(false)
  })

  it('allows swap after moving enough distance up', () => {
    expect(shouldSwapTracks(100, 69, false)).toBe(true)
    expect(shouldSwapTracks(100, 0, false)).toBe(true)
  })

  it('prevents swap when moving opposite direction (trying to go up after swapping down)', () => {
    // last swap was at y=100, now trying to swap up but cursor at y=90
    // distance moved up is only 10px, need 30px
    expect(shouldSwapTracks(100, 90, false)).toBe(false)
  })

  it('prevents swap when moving opposite direction (trying to go down after swapping up)', () => {
    // last swap was at y=100, now trying to swap down but cursor at y=110
    // distance moved down is only 10px, need 30px
    expect(shouldSwapTracks(100, 110, true)).toBe(false)
  })

  it('handles the rapid back-and-forth swapping scenario', () => {
    // Scenario: dragging a short track (100px) down over a tall track (500px)
    // 1. First swap happens at y=200
    const firstSwapY = 200
    expect(shouldSwapTracks(undefined, firstSwapY, true)).toBe(true)

    // 2. After swap, cursor is still at y=200 but now over the tall track
    //    The tall track tries to swap back (movingDown=false since it would move the dragged track up)
    //    This should be prevented because we haven't moved 30px up from lastSwapY
    expect(shouldSwapTracks(firstSwapY, firstSwapY, false)).toBe(false)

    // 3. Even small movements shouldn't trigger swap back
    expect(shouldSwapTracks(firstSwapY, 190, false)).toBe(false)
    expect(shouldSwapTracks(firstSwapY, 180, false)).toBe(false)

    // 4. Only after moving 30px+ up should swap be allowed
    expect(shouldSwapTracks(firstSwapY, 169, false)).toBe(true)
  })
})
