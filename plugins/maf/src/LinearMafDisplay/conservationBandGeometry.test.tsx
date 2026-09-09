import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import MafConservationBand from './components/MafConservationBand.tsx'
import { conservationTicks } from './components/drawConservation.ts'
import { renderSvg } from './renderSvg.tsx'
import { createMafTestEnvironment } from './testEnv.ts'

import type React from 'react'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

// The band is dragged tall while the track is tall, then the track is dragged
// short — two ordinary drags, and `resizeConservationHeight` clamps against the
// height of the moment, so nothing re-clamps the slot afterwards. `topBands`
// binds it at read time instead, which is what every painter, axis and handle
// has to agree with: at a 300px slot bound to a 180px reservation the band
// otherwise paints 120px down over the rows and puts its own resize handle at
// y=341, outside a display box `contain: strict` clips.
function overStatedBand() {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setShowConservation(true)
  display.setHeight(1000)
  display.resizeConservationHeight(+260)
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
  it('sizes its canvas to the reservation', () => {
    const display = overStatedBand()
    const { container } = render(
      <MafConservationBand model={display} onResizeActiveChange={() => {}} />,
    )
    const canvas = container.querySelector('canvas')
    expect(canvas?.style.height).toBe(`${display.conservationDisplayHeight}px`)
    expect(canvas?.style.top).toBe(`${display.topBands.top.conservation}px`)
  })

  it('leaves the resize handle inside the display', () => {
    const display = overStatedBand()
    const { container } = render(
      <MafConservationBand model={display} onResizeActiveChange={() => {}} />,
    )
    const handle = container.querySelector('div')
    expect(handle?.style.top).toBe(`${display.rowsTopOffset - 4}px`)
    expect(display.rowsTopOffset - 4).toBeLessThan(display.height)
  })

  // The axis is the chrome's, off `axes`: the band it declares is the
  // reservation, and its ticks are laid out in it.
  it('declares its axis at the reservation', () => {
    const display = overStatedBand()
    const axis = display.axes.find(a => a.domain[1] === 100)!
    expect(axis.height).toBe(display.conservationDisplayHeight)
    expect(axis.bandTops).toEqual([display.topBands.top.conservation])
    expect(axis.ticks).toEqual(
      conservationTicks(display.conservationDisplayHeight),
    )
  })

  it('exports the axis it drew on screen', async () => {
    const display = overStatedBand()
    const svg = drawSvg(await renderSvg(display, {}))
    expect(svg).toContain(midAxisTick(display.conservationDisplayHeight))
    expect(svg).not.toContain(midAxisTick(display.conservationHeight))
  })
})
