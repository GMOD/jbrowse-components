import { useRef } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { useRangeSelect } from './useRangeSelect.ts'

import type { LinearGenomeViewModel } from '../model.ts'

function TestRubberband({ model }: { model: LinearGenomeViewModel }) {
  const ref = useRef<HTMLDivElement>(null)
  const { mouseDown, mouseMove, mouseOut } = useRangeSelect(ref, model)
  return (
    <div
      data-testid="rubberband"
      ref={ref}
      onMouseDown={mouseDown}
      onMouseMove={mouseMove}
      onMouseOut={mouseOut}
    />
  )
}

function makeModel(setOffsets = jest.fn()) {
  return {
    isScalebarRefNameMenuOpen: false,
    scalebarRefNameClickPending: false,
    setScalebarRefNameClickPending: jest.fn(),
    setOffsets,
    pxToBp: (px: number) => ({ index: 0, offset: px, refName: 'ctgA' }),
    bpPerPx: 1,
  } as unknown as LinearGenomeViewModel
}

describe('useRangeSelect (LGV)', () => {
  it('commits selection on window mouseup after drag', () => {
    const setOffsets = jest.fn()
    render(<TestRubberband model={makeModel(setOffsets)} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 250, clientY: 0 }),
      )
    })

    // left=100, right=250 (jsdom getBoundingClientRect returns left=0)
    expect(setOffsets).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 }),
      expect.objectContaining({ offset: 250 }),
    )
  })

  it('does not commit selection for small drag (click)', () => {
    const setOffsets = jest.fn()
    render(<TestRubberband model={makeModel(setOffsets)} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 102, clientY: 0 }),
      )
    })

    expect(setOffsets).not.toHaveBeenCalled()
  })

  it('escape key during drag cancels selection', () => {
    const setOffsets = jest.fn()
    render(<TestRubberband model={makeModel(setOffsets)} />)
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

    expect(setOffsets).not.toHaveBeenCalled()
  })
})
