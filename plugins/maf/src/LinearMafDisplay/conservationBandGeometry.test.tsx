import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import MafBandHandles from './components/MafBandHandles.tsx'
import { conservationTicks } from './components/conservationBand.ts'
import { renderSvg } from './renderSvg.tsx'
import { createMafTestEnvironment } from './testEnv.ts'

import type React from 'react'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

// The band is dragged tall while the track is tall, then the track is dragged
// short — two ordinary drags, and `setConservationHeight` clamps against the
// height of the moment, so nothing re-clamps the slot afterwards. `topBands`
// binds it at read time instead, which is what every painter, axis and handle
// has to agree with: at a 300px slot bound to a 180px reservation the band
// otherwise paints 120px down over the rows and puts its own resize handle at
// y=341, outside a display box `contain: strict` clips.
function overStatedBand() {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setShowConservation(true)
  display.setHeight(1000)
  display.setConservationHeight(display.conservationHeight + 260)
  display.setHeight(200)
  return display
}

// The 50% tick's group transform, which is where the axis says what height it
// was scaled to. The end ticks are crispened inward by `YScaleBar` and so are a
// pixel off the band edge; the middle one is not touched.
function midAxisTick(height: number) {
  const { yTop, yBottom } = conservationTicks(height)
  return `translate(0,${(yTop + yBottom) / 2 + 0.5})`
}

function drawSvg(result: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{result}</svg>
    </ThemeProvider>,
  )
}

describe('the conservation band paints the height it reserved', () => {
  it('hands its mark the reservation', () => {
    const display = overStatedBand()
    expect(display.renderState.conservation).toEqual({
      top: display.topBands.top.conservation,
      height: display.topBands.rects.conservation.height,
    })
  })

  it('leaves the resize handle inside the display', () => {
    const display = overStatedBand()
    const { container } = render(<MafBandHandles model={display} />)
    const handle = [...container.querySelectorAll('div')].at(-1)
    expect(handle?.style.top).toBe(`${display.rowsTopOffset - 4}px`)
    expect(display.rowsTopOffset - 4).toBeLessThan(display.height)
  })

  // with the rows hidden the coverage takes what the conservation band leaves
  // of the track, so only the conservation band has a handle, on its top seam,
  // and a drag up grows it until the coverage is down to its floor
  it('offers the conservation band alone a handle while the rows are hidden', () => {
    const display = overStatedBand()
    display.setShowAlignments(false)
    expect(display.topBands.rects).toEqual({
      coverage: { top: 0, height: 20 },
      conservation: { top: 20, height: 180 },
    })
    render(<MafBandHandles model={display} />)
    expect(screen.queryByTitle('Drag to resize the coverage band')).toBeNull()
    const seam = screen.getByTitle('Drag to resize the conservation band')
    expect(seam.style.top).toBe('16px')

    const { coverageHeight, height } = display
    const drag = (dy: number) => {
      fireEvent.pointerDown(seam, { clientY: 500, pointerId: 1 })
      fireEvent.pointerMove(seam, { clientY: 500 + dy, pointerId: 1 })
      fireEvent.pointerUp(seam, { clientY: 500 + dy, pointerId: 1 })
    }
    drag(100)
    expect(display.conservationHeight).toBe(80)
    expect(display.topBands.rects.coverage.height).toBe(120)
    drag(-1000)
    expect(display.conservationHeight).toBe(180)
    expect(display.coverageHeight).toBe(coverageHeight)
    expect(display.height).toBe(height)
  })

  // The axis is the chrome's, off `axes`: the band it declares is the
  // reservation, and its ticks are laid out in it.
  it('declares its axis at the reservation', () => {
    const display = overStatedBand()
    const axis = display.axes.find(a => a.domain[1] === 100)!
    expect(axis.height).toBe(display.topBands.rects.conservation.height)
    expect(axis.bandTops).toEqual([display.topBands.top.conservation])
    expect(axis.ticks).toEqual(
      conservationTicks(display.topBands.rects.conservation.height),
    )
  })

  it('exports the axis it drew on screen', async () => {
    const display = overStatedBand()
    const svg = drawSvg(await renderSvg(display, {}))
    expect(svg).toContain(
      midAxisTick(display.topBands.rects.conservation.height),
    )
    expect(svg).not.toContain(midAxisTick(display.conservationHeight))
  })
})
