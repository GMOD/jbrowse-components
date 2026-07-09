import { applyRowResizeWheel } from './applyRowResizeWheel.ts'

// One px of row-height change now takes this many normalized wheel px (the
// resize is proportional to the scroll delta, not ±1 per event). Mirrors
// RESIZE_PX_PER_WHEEL_PX = 1/240 in applyRowResizeWheel.ts; using multiples of
// it keeps the assertions on whole-pixel row heights.
const PX_PER_ROW_PX = 240

// minimal stand-ins: applyRowResizeWheel reads deltaY/clientY, calls
// preventDefault, and getBoundingClientRect().top off the element
function wheel(deltaY: number, clientY: number) {
  let prevented = false
  return {
    event: {
      deltaY,
      clientY,
      preventDefault() {
        prevented = true
      },
    } as unknown as WheelEvent,
    wasPrevented: () => prevented,
  }
}

function el(top: number) {
  return { getBoundingClientRect: () => ({ top }) } as unknown as HTMLElement
}

function harness(init: { rowHeight: number; scrollTop: number; nrow: number }) {
  const state = { ...init }
  return {
    target: {
      get rowHeight() {
        return state.rowHeight
      },
      get scrollTop() {
        return state.scrollTop
      },
      nrow: state.nrow,
      viewportHeight: 100,
      setRowHeight: (n: number) => {
        state.rowHeight = n
      },
      setScrollTop: (n: number) => {
        state.scrollTop = n
      },
    },
    state,
  }
}

test('preventDefault is called so the panel resizes instead of scrolling', () => {
  const w = wheel(-1, 50)
  const { target } = harness({ rowHeight: 10, scrollTop: 0, nrow: 10 })
  applyRowResizeWheel(w.event, el(0), target)
  expect(w.wasPrevented()).toBe(true)
})

test('deltaY<0 grows rows, deltaY>0 shrinks, clamped to [viewport/nrow, 20]', () => {
  const grow = harness({ rowHeight: 10, scrollTop: 0, nrow: 10 })
  applyRowResizeWheel(wheel(-PX_PER_ROW_PX, 0).event, el(0), grow.target)
  expect(grow.state.rowHeight).toBe(11)

  // min row height here is viewport/nrow = 100/10 = 10, so start above it
  const shrink = harness({ rowHeight: 15, scrollTop: 0, nrow: 10 })
  applyRowResizeWheel(wheel(PX_PER_ROW_PX, 0).event, el(0), shrink.target)
  expect(shrink.state.rowHeight).toBe(14)

  // max row height is 20
  const atMax = harness({ rowHeight: 20, scrollTop: 0, nrow: 10 })
  applyRowResizeWheel(wheel(-PX_PER_ROW_PX, 0).event, el(0), atMax.target)
  expect(atMax.state.rowHeight).toBe(20)

  // min row height is viewportHeight/nrow = 100/10 = 10 (the auto-fit height)
  const atMin = harness({ rowHeight: 10, scrollTop: 0, nrow: 10 })
  applyRowResizeWheel(wheel(PX_PER_ROW_PX, 0).event, el(0), atMin.target)
  expect(atMin.state.rowHeight).toBe(10)
})

test('few samples: auto-fit floor above MAX_ROW_HEIGHT is not collapsed to the cap', () => {
  // viewport 100, 3 samples -> auto-fit height 33.3, above the 20px cap. A grow
  // gesture must not snap rows down to 20 (the pre-fix bug); the fit floor wins.
  const grow = harness({ rowHeight: 100 / 3, scrollTop: 0, nrow: 3 })
  applyRowResizeWheel(wheel(-PX_PER_ROW_PX, 0).event, el(0), grow.target)
  expect(grow.state.rowHeight).toBeCloseTo(100 / 3)

  const shrink = harness({ rowHeight: 100 / 3, scrollTop: 0, nrow: 3 })
  applyRowResizeWheel(wheel(PX_PER_ROW_PX, 0).event, el(0), shrink.target)
  expect(shrink.state.rowHeight).toBeCloseTo(100 / 3)
})

test('keeps the row under the cursor pinned in place as the height changes', () => {
  // cursor 50px below the element top, scrolled 100px, rows 10px tall -> the
  // row under the cursor is (50+100)/10 = row 15. After growing to 11px that
  // row sits at 15*11 = 165, so scrollTop must become 165-50 = 115 to keep it
  // under the cursor.
  const { target, state } = harness({ rowHeight: 10, scrollTop: 100, nrow: 10 })
  applyRowResizeWheel(wheel(-PX_PER_ROW_PX, 50).event, el(0), target)
  expect(state.rowHeight).toBe(11)
  expect(state.scrollTop).toBe(115)
})

test('subtracts the element top so the pin math is relative to the panel', () => {
  // identical to above but the panel starts 30px down the page; clientY 80 maps
  // to the same 50px panel-relative cursor, so the result is unchanged.
  const { target, state } = harness({ rowHeight: 10, scrollTop: 100, nrow: 10 })
  applyRowResizeWheel(wheel(-PX_PER_ROW_PX, 80).event, el(30), target)
  expect(state.scrollTop).toBe(115)
})
