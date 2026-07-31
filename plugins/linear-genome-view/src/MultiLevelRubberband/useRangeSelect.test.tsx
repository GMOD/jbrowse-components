import { useRef } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { useRangeSelect } from './useRangeSelect.ts'

import type { MultiLevelRubberbandModel } from './types.ts'

function TestRubberband({ model }: { model: MultiLevelRubberbandModel }) {
  const ref = useRef<HTMLDivElement>(null)
  const { mouseDown, mouseMove, mouseOut } = useRangeSelect(ref, model)
  return (
    <div
      data-testid="rubberband"
      ref={ref}
      onMouseDown={mouseDown}
      onMouseMove={mouseMove}
      // onMouseLeave, matching MultiLevelRubberband
      onMouseLeave={mouseOut}
    />
  )
}

function makeView(setOffsets = jest.fn()) {
  return {
    pxToBp: (px: number) => ({ index: 0, offset: px, refName: 'ctgA' }),
    setOffsets,
    bpPerPx: 1,
  }
}

// A cancelled selection still calls setOffsets(undefined, undefined) to release
// any previous one, so "nothing was selected" is about no call carrying an actual
// pair of offsets — not about setOffsets never firing.
function expectNoSelectionCommitted(setOffsets: jest.Mock) {
  expect(setOffsets.mock.calls).not.toContainEqual([
    expect.anything(),
    expect.anything(),
  ])
}

describe('useRangeSelect (MultiLevelRubberband)', () => {
  it('commits selection for all views on window mouseup after drag', () => {
    const setOffsets0 = jest.fn()
    const setOffsets1 = jest.fn()
    const model = {
      views: [makeView(setOffsets0), makeView(setOffsets1)],
    } as unknown as MultiLevelRubberbandModel

    render(<TestRubberband model={model} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 250, clientY: 0 }),
      )
    })

    // left=100, right=250 (jsdom getBoundingClientRect returns left=0)
    expect(setOffsets0).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 }),
      expect.objectContaining({ offset: 250 }),
    )
    expect(setOffsets1).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 }),
      expect.objectContaining({ offset: 250 }),
    )
  })

  it('does not commit selection for small drag (click)', () => {
    const setOffsets = jest.fn()
    const model = {
      views: [makeView(setOffsets)],
    } as unknown as MultiLevelRubberbandModel

    render(<TestRubberband model={model} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 102, clientY: 0 }),
      )
    })

    expectNoSelectionCommitted(setOffsets)
  })

  it('escape key during drag cancels selection', () => {
    const setOffsets = jest.fn()
    const model = {
      views: [makeView(setOffsets)],
    } as unknown as MultiLevelRubberbandModel

    render(<TestRubberband model={model} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 250, clientY: 0 }),
      )
    })

    expectNoSelectionCommitted(setOffsets)
  })

  it('selects left-to-right regardless of drag direction', () => {
    const setOffsets = jest.fn()
    const model = {
      views: [makeView(setOffsets)],
    } as unknown as MultiLevelRubberbandModel

    render(<TestRubberband model={model} />)
    const el = screen.getByTestId('rubberband')

    // drag right-to-left: mousedown at 250, mouseup at 100
    fireEvent.mouseDown(el, { clientX: 250, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 0 }),
      )
    })

    expect(setOffsets).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 }),
      expect.objectContaining({ offset: 250 }),
    )
  })

  // the menu's items act on the committed offsets, and reaching the menu means
  // moving the pointer off the strip
  it('keeps the committed selection when the pointer leaves with the menu open', () => {
    const setOffsets = jest.fn()
    const model = {
      views: [makeView(setOffsets)],
    } as unknown as MultiLevelRubberbandModel

    render(<TestRubberband model={model} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 250, clientY: 0 }),
      )
    })
    setOffsets.mockClear()
    fireEvent.mouseLeave(el)

    expect(setOffsets).not.toHaveBeenCalled()
  })
})
