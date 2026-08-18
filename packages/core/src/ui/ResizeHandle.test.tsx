import { act, fireEvent, render } from '@testing-library/react'

import { colord } from '../util/colord.ts'
import ResizeHandle from './ResizeHandle.tsx'

// Faithful rAF mock (same shape as useRafCommit.test): cancel really drops the
// callback, so the unmount-cancel path is exercised rather than assumed.
let rafMap = new Map<number, FrameRequestCallback>()
let nextRafId = 1
const realRaf = window.requestAnimationFrame
const realCancel = window.cancelAnimationFrame

beforeEach(() => {
  rafMap = new Map()
  nextRafId = 1
  window.requestAnimationFrame = cb => {
    const id = nextRafId++
    rafMap.set(id, cb)
    return id
  }
  window.cancelAnimationFrame = id => {
    rafMap.delete(id)
  }
})

afterEach(() => {
  window.requestAnimationFrame = realRaf
  window.cancelAnimationFrame = realCancel
})

function flushRaf() {
  const cbs = [...rafMap.values()]
  rafMap = new Map()
  act(() => {
    for (const cb of cbs) {
      cb(0)
    }
  })
}

/**
 * The resting and hover background a `bar` handle actually resolves to, read
 * off the emitted stylesheet.
 *
 * Not `getComputedStyle`, which resolves no `:hover` in jsdom — and the hover is
 * the half that was wrong. Two classes on the element carry a `:hover`
 * background at equal specificity, so the browser settles it on source order and
 * so does this: iterate the sheet in order and keep the last match.
 */
function readBarAlphas(el: HTMLElement) {
  let rest = ''
  let hover = ''
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule)) {
        continue
      }
      const bg = rule.style.backgroundColor || rule.style.background
      if (!bg) {
        continue
      }
      for (const cls of el.classList) {
        if (rule.selectorText === `.${cls}`) {
          rest = bg
        } else if (rule.selectorText === `.${cls}:hover`) {
          hover = bg
        }
      }
    }
  }
  return { rest, hover }
}

function drag(el: HTMLElement, ys: number[]) {
  fireEvent.pointerDown(el, { clientY: 0, pointerId: 1, button: 0 })
  for (const clientY of ys) {
    fireEvent.pointerMove(el, { clientY, pointerId: 1 })
  }
}

describe('ResizeHandle', () => {
  it('reports the distance dragged, once per frame', () => {
    const onDrag = jest.fn()
    const { container } = render(<ResizeHandle onDrag={onDrag} />)
    const handle = container.firstChild as HTMLElement

    drag(handle, [10, 20, 30])
    // three moves in one frame coalesce to a single commit carrying the total
    expect(onDrag).not.toHaveBeenCalled()
    flushRaf()
    expect(onDrag).toHaveBeenCalledTimes(1)
    expect(onDrag).toHaveBeenCalledWith(30)

    // the next frame's delta is measured from the last committed position, so
    // the coalescing never loses or double-counts distance
    fireEvent.pointerMove(handle, { clientY: 45, pointerId: 1 })
    flushRaf()
    expect(onDrag).toHaveBeenLastCalledWith(15)
  })

  it('flushes the pending frame on drag end, so the resting size is exact', () => {
    const onDrag = jest.fn()
    const onDragEnd = jest.fn()
    const { container } = render(
      <ResizeHandle onDrag={onDrag} onDragEnd={onDragEnd} />,
    )
    const handle = container.firstChild as HTMLElement

    drag(handle, [25])
    fireEvent.pointerUp(handle, { clientY: 25, pointerId: 1 })
    expect(onDrag).toHaveBeenCalledWith(25)
    expect(onDragEnd).toHaveBeenCalled()
  })

  // the hand-rolled rAF this replaced had no cleanup, so a drag interrupted by
  // an unmount fired onDrag into a torn-down tree
  it('cancels a pending frame on unmount', () => {
    const onDrag = jest.fn()
    const { container, unmount } = render(<ResizeHandle onDrag={onDrag} />)
    drag(container.firstChild as HTMLElement, [10])

    unmount()
    flushRaf()
    expect(onDrag).not.toHaveBeenCalled()
  })

  it('claims the press so ancestor gestures stand down', () => {
    const { container } = render(<ResizeHandle onDrag={() => {}} />)
    expect((container.firstChild as HTMLElement).dataset.gestureOwner).toBe(
      'true',
    )
  })

  // `bar` is the whole difference between a divider someone can see and a 4px
  // strip of nothing, and it is one word at a call site — a rebase or a
  // stray reformat drops it without changing behaviour anything else asserts.
  it('draws nothing until hover without `bar`, and a divider with it', () => {
    const { container: plain } = render(<ResizeHandle onDrag={() => {}} />)
    const { container: barred } = render(<ResizeHandle bar onDrag={() => {}} />)
    const bgAlpha = (c: HTMLElement) =>
      colord(
        getComputedStyle(c.firstChild as HTMLElement).backgroundColor,
      ).alpha()

    expect(bgAlpha(plain)).toBe(0)
    expect(bgAlpha(barred)).toBeGreaterThan(0)
  })

  // A bar rests at `action.disabled` and used to inherit the invisible handles'
  // `action.selected` hover, which is *lighter* — so the one gesture that should
  // confirm "yes, this is the thing you grab" made it harder to see. Read off the
  // stylesheet because jsdom resolves no `:hover`.
  it('gets darker under the pointer, not lighter', () => {
    const { container } = render(<ResizeHandle bar onDrag={() => {}} />)
    const { rest, hover } = readBarAlphas(container.firstChild as HTMLElement)
    expect(rest).toBeTruthy()
    expect(hover).toBeTruthy()
    expect(colord(hover).alpha()).toBeGreaterThan(colord(rest).alpha())
  })

  // The ladder: an invisible handle reveals itself at the weight a bar rests at,
  // so a divider drawn over a dense pileup (the alignments coverage band, the
  // group splits) answers the pointer at all.
  it('reveals an invisible handle at a visible handle resting weight', () => {
    const { container: plain } = render(<ResizeHandle onDrag={() => {}} />)
    const { container: barred } = render(<ResizeHandle bar onDrag={() => {}} />)
    const plainHover = readBarAlphas(plain.firstChild as HTMLElement).hover
    const barRest = readBarAlphas(barred.firstChild as HTMLElement).rest

    expect(colord(plainHover).alpha()).toBe(colord(barRest).alpha())
  })
})
