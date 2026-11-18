import { submenuSide } from './submenuSide.ts'

const side = (
  preferred: 'left' | 'right',
  row: { left: number; right: number },
) => submenuSide(preferred, row, 250, 1000)

describe('submenuSide', () => {
  it('opens right when the panel fits there', () => {
    expect(side('right', { left: 100, right: 300 })).toBe('right')
  })

  it('turns left for a menu pinned to the right edge', () => {
    expect(side('right', { left: 700, right: 990 })).toBe('left')
  })

  it('keeps going left under a panel that already turned', () => {
    expect(side('left', { left: 450, right: 690 })).toBe('left')
  })

  it('turns back right when a left-going cascade reaches the left edge', () => {
    expect(side('left', { left: 20, right: 300 })).toBe('right')
  })

  it('stays on the preferred side when neither side fits but it has the room', () => {
    expect(submenuSide('right', { left: 100, right: 600 }, 600, 1000)).toBe(
      'right',
    )
  })
})
