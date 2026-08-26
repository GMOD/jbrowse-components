import { isAimedAtPanel } from './submenuAim.ts'

// A menu whose paper ends at x=200, with the panel it opened occupying
// x 200..400 and y 0..300 — the panel's top level with the row the pointer
// left, which is where MUI anchors it.
const panel = { left: 200, right: 400, top: 0, bottom: 300 }
const apex = { x: 100, y: 10 }
const aimed = (x: number, y: number) => isAimedAtPanel({ x, y }, apex, panel)

describe('isAimedAtPanel', () => {
  it('admits a diagonal that crosses the rows between', () => {
    // half way across, so the cone spans y 5..155 — several rows' worth of
    // drift, which is exactly the travel a per-row close used to kill
    expect(aimed(150, 100)).toBe(true)
  })

  it('rejects a pointer going straight down the menu', () => {
    expect(aimed(100, 100)).toBe(false)
  })

  it('rejects a pointer going back up the menu', () => {
    expect(aimed(100, 0)).toBe(false)
  })

  it('rejects a pointer heading away from the panel', () => {
    expect(aimed(60, 40)).toBe(false)
  })

  // The cone is narrow next to the row and wide next to the panel. Same
  // vertical drift, opposite verdicts — this is the whole reason it beats a
  // fixed delay, so pin both ends of it.
  it('narrows toward the tip', () => {
    expect(aimed(110, 40)).toBe(false)
    expect(aimed(190, 40)).toBe(true)
  })

  it('admits the panel corners it opens onto', () => {
    expect(aimed(200, 0)).toBe(true)
    expect(aimed(200, 300)).toBe(true)
  })

  it('rejects a pointer past the near edge but off the panel', () => {
    expect(aimed(300, 400)).toBe(false)
    expect(aimed(300, -100)).toBe(false)
  })

  // MUI flips a submenu to the left of its row when the viewport has no room
  // on the right, and the cone has to follow it rather than keep pointing at
  // where a panel usually goes.
  it('follows a panel flipped to the other side', () => {
    const flipped = { left: -200, right: 0, top: 0, bottom: 300 }
    expect(isAimedAtPanel({ x: 50, y: 100 }, apex, flipped)).toBe(true)
    expect(isAimedAtPanel({ x: 150, y: 100 }, apex, flipped)).toBe(false)
  })

  // A panel MUI shifted upward, off the bottom of the viewport: the cone
  // interpolates from the tip to the real edge, so it opens up-and-across
  // rather than assuming a panel always hangs downward.
  it('opens toward a panel above the row', () => {
    const raised = { left: 200, right: 400, top: -300, bottom: 20 }
    expect(isAimedAtPanel({ x: 150, y: -100 }, apex, raised)).toBe(true)
    expect(isAimedAtPanel({ x: 150, y: 100 }, apex, raised)).toBe(false)
  })

  it('admits a pointer that opened the panel from its very edge', () => {
    expect(isAimedAtPanel({ x: 200, y: 999 }, { x: 200, y: 10 }, panel)).toBe(
      true,
    )
  })
})
