import { useRef } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { useRangeSelect } from './useRangeSelect.ts'

import type { LinearGenomeViewModel } from '../model.ts'

function TestRubberband({ model }: { model: LinearGenomeViewModel }) {
  const ref = useRef<HTMLDivElement>(null)
  const { mouseDown, mouseMove, mouseOut, guideX, open } = useRangeSelect(
    ref,
    model,
  )
  return (
    <div
      data-testid="rubberband"
      ref={ref}
      onMouseDown={mouseDown}
      onMouseMove={mouseMove}
      onMouseOut={mouseOut}
    >
      {/* expose internal hook state so assertions can observe it */}
      <span data-testid="guideX">{guideX ?? 'none'}</span>
      <span data-testid="menuOpen">{String(open)}</span>
    </div>
  )
}

function makeModel({
  setOffsets = jest.fn(),
  scalebarRefNameClickPending = false,
  setScalebarRefNameClickPending = jest.fn(),
}: {
  setOffsets?: jest.Mock
  scalebarRefNameClickPending?: boolean
  setScalebarRefNameClickPending?: jest.Mock
} = {}) {
  return {
    isScalebarRefNameMenuOpen: false,
    scalebarRefNameClickPending,
    setScalebarRefNameClickPending,
    setOffsets,
    pxToBp: (px: number) => ({ index: 0, offset: px, refName: 'ctgA' }),
    bpPerPx: 1,
  } as unknown as LinearGenomeViewModel
}

describe('useRangeSelect (LGV)', () => {
  it('commits selection on window mouseup after drag', () => {
    const setOffsets = jest.fn()
    render(<TestRubberband model={makeModel({ setOffsets })} />)
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
    render(<TestRubberband model={makeModel({ setOffsets })} />)
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 102, clientY: 0 }),
      )
    })

    expect(setOffsets).not.toHaveBeenCalled()
  })

  it('mouseOut clears the hover guide', () => {
    render(<TestRubberband model={makeModel()} />)
    const el = screen.getByTestId('rubberband')

    // hovering shows a guide line at the cursor (jsdom rect left=0, so
    // relativeX === clientX)
    fireEvent.mouseMove(el, { clientX: 50 })
    expect(screen.getByTestId('guideX').textContent).toBe('50')

    // mouseOut must clear it — this is the contract TracksContainer relies on
    // after wiring onMouseOut (it previously left a stray guide)
    fireEvent.mouseOut(el)
    expect(screen.getByTestId('guideX').textContent).toBe('none')
  })

  it('a new drag re-engages after a click opened the menu', () => {
    const setOffsets = jest.fn()
    render(<TestRubberband model={makeModel({ setOffsets })} />)
    const el = screen.getByTestId('rubberband')

    // first interaction: a click (tiny movement) opens the menu
    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 101, clientY: 0 }),
      )
    })
    expect(screen.getByTestId('menuOpen').textContent).toBe('true')

    // second interaction: a real drag. mouseDown must clear the stale
    // anchorPosition (regression: otherwise mouseDragging stayed false and the
    // global mouseup listener never attached, so the drag silently no-op'd)
    fireEvent.mouseDown(el, { clientX: 200, clientY: 0 })
    expect(screen.getByTestId('menuOpen').textContent).toBe('false')
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 400, clientY: 0 }),
      )
    })
    expect(setOffsets).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 200 }),
      expect.objectContaining({ offset: 400 }),
    )
  })

  it('escape key during drag cancels selection', () => {
    const setOffsets = jest.fn()
    render(<TestRubberband model={makeModel({ setOffsets })} />)
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

  it('a click begun on a refName label suppresses the rubberband menu and clears the pending flag', () => {
    const setOffsets = jest.fn()
    const setScalebarRefNameClickPending = jest.fn()
    render(
      <TestRubberband
        model={makeModel({
          setOffsets,
          scalebarRefNameClickPending: true,
          setScalebarRefNameClickPending,
        })}
      />,
    )
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 101, clientY: 0 }),
      )
    })

    // rubberband menu must not open — the label's own onClick handles it
    expect(screen.getByTestId('menuOpen').textContent).toBe('false')
    // flag cleared here (not left for the label's onClick), so it can't get
    // stuck and swallow the next scalebar click if mouseup drifts off the label
    expect(setScalebarRefNameClickPending).toHaveBeenCalledWith(false)
  })

  it('a drag begun on a refName label still commits and clears the pending flag', () => {
    const setOffsets = jest.fn()
    const setScalebarRefNameClickPending = jest.fn()
    render(
      <TestRubberband
        model={makeModel({
          setOffsets,
          scalebarRefNameClickPending: true,
          setScalebarRefNameClickPending,
        })}
      />,
    )
    const el = screen.getByTestId('rubberband')

    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 250, clientY: 0 }),
      )
    })

    expect(setScalebarRefNameClickPending).toHaveBeenCalledWith(false)
    expect(setOffsets).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 }),
      expect.objectContaining({ offset: 250 }),
    )
  })
})
