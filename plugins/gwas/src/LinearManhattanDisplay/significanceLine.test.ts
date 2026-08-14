import { getConf, setConf } from '@jbrowse/core/configuration'
import { axisPlotBox } from '@jbrowse/wiggle-core'

import { significanceLineY } from './components/SignificanceLine.tsx'
import { createTestEnvironment } from './testEnv.ts'

// The threshold line's whole job is to land on the same y a point of that score
// lands on, so these check it against the axis geometry rather than against a
// remembered number.
describe('significanceLineY', () => {
  const HEIGHT = 200
  const box = axisPlotBox(HEIGHT)

  it('puts the domain ends at the plot box ends', () => {
    expect(significanceLineY(10, [0, 10], HEIGHT)).toBe(box.yTop)
    // the bottom is clamped a stroke inside the axis, the same way a tick is,
    // so the line cannot render half outside the plot
    expect(significanceLineY(0, [0, 10], HEIGHT)).toBeLessThanOrEqual(
      box.yBottom,
    )
    expect(significanceLineY(0, [0, 10], HEIGHT)).toBeGreaterThan(
      box.yBottom - 2,
    )
  })

  it('places a mid-domain score halfway down the plot', () => {
    expect(significanceLineY(5, [0, 10], HEIGHT)).toBeCloseTo(
      box.yTop + box.plotHeight / 2,
    )
  })

  it('is undefined outside the loaded domain, rather than pinned to an edge', () => {
    // The domain is the loaded regions' min/max, so zooming to a quiet stretch
    // can put the threshold above everything on screen. Drawing it at the top
    // edge there would read as "all of this is over the line".
    expect(significanceLineY(11, [0, 10], HEIGHT)).toBeUndefined()
    expect(significanceLineY(-1, [0, 10], HEIGHT)).toBeUndefined()
  })

  it('is undefined when unset or before data loads', () => {
    expect(significanceLineY(undefined, [0, 10], HEIGHT)).toBeUndefined()
    expect(significanceLineY(5, undefined, HEIGHT)).toBeUndefined()
  })

  it('survives a degenerate domain rather than dividing by zero', () => {
    expect(significanceLineY(5, [5, 5], HEIGHT)).toBeUndefined()
  })
})

describe('significanceLine config slot', () => {
  it('defaults to unset, so no line is drawn', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(getConf(display, 'significanceLine')).toBeUndefined()
    expect(display.significanceLineY).toBeUndefined()
  })

  it('is readable off the display once configured', () => {
    const { display } = createTestEnvironment().createDisplay()
    setConf(display, 'significanceLine', 7.3)
    expect(getConf(display, 'significanceLine')).toBe(7.3)
    // still undefined with no data loaded, since there is no domain to place
    // it on yet
    expect(display.significanceLineY).toBeUndefined()
  })
})
