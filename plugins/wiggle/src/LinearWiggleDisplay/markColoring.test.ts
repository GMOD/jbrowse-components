import { plotColorOf } from './plotColorLine.ts'
import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleMark } from '../util.ts'

// Two subtracks, by default ones their file colors, as a MultiWiggleAdapter's
// subadapters can.
function makeDisplay({
  rows,
  mark,
  displayConfig,
  fileColors = true,
}: {
  rows: boolean
  mark?: WiggleMark
  displayConfig?: Record<string, unknown>
  fileColors?: boolean
}) {
  const { createDisplay } = createTestEnvironment({ displayConfig })
  const { display, view } = createDisplay()
  display.setRowLayout(rows)
  display.setRpcData(
    0,
    {
      sources: [
        { ...makeSource('a'), ...(fileColors ? { color: '#aa0000' } : {}) },
        { ...makeSource('b'), ...(fileColors ? { color: '#0000aa' } : {}) },
      ],
    },
    view.displayedRegions[0],
  )
  if (mark) {
    display.setMark(mark)
  }
  return display
}

const markColors = (display: ReturnType<typeof makeDisplay>) =>
  display.markSources.map(s => s.color)

describe('a written color paints every mark', () => {
  it.each([true, false])('rows %p: a constant, not the files', rows => {
    const display = makeDisplay({
      rows,
      displayConfig: { encoding: { color: { value: 'darkgreen' } } },
    })
    expect(markColors(display)).toEqual([undefined, undefined])
    expect(display.wiggleColor.posColor).toBe('darkgreen')
  })

  it('a written threshold paints its range, not the files', () => {
    const display = makeDisplay({
      rows: true,
      displayConfig: {
        encoding: {
          color: { scale: { type: 'threshold', range: ['red', 'blue'] } },
        },
      },
    })
    expect(markColors(display)).toEqual([undefined, undefined])
  })

  it('unset, each subtrack paints its own color', () => {
    expect(markColors(makeDisplay({ rows: true }))).toEqual([
      '#aa0000',
      '#0000aa',
    ])
  })
})

describe('the field says what the color reads', () => {
  it('score keeps the pair beside colored subtracks', () => {
    const display = makeDisplay({
      rows: true,
      displayConfig: { encoding: { color: { field: 'score' } } },
    })
    expect(markColors(display)).toEqual([undefined, undefined])
    expect(display.wiggleColor.posColor).not.toBe(display.wiggleColor.negColor)
  })

  it('source paints the subtracks under a heatmap, flat, and says so', () => {
    const display = makeDisplay({
      rows: true,
      mark: 'rect',
      displayConfig: { encoding: { color: 'source' } },
    })
    expect(markColors(display)).toEqual(['#aa0000', '#0000aa'])
    expect(display.scoreGradientPaints).toBe(false)
  })

  it('a written source color hides the pair swatches a write would drop it with', () => {
    const display = makeDisplay({
      rows: true,
      fileColors: false,
      displayConfig: { encoding: { color: 'source' } },
    })
    expect(plotColorOf(display).line.mode).toBe('hide')
  })
})

describe('the key names what an overlaid density paints', () => {
  it.each([true, false])(
    'file colors %p: the ramp paints every strip and is the key',
    fileColors => {
      const display = makeDisplay({
        rows: false,
        mark: 'rect',
        fileColors,
        displayConfig: {
          rowColor: { scale: { domain: ['a', 'b'], range: ['red', 'blue'] } },
        },
      })
      expect(markColors(display)).toEqual([undefined, undefined])
      expect(display.scoreGradientPaints).toBe(true)
      expect(display.colorScales.map(s => s.kind)).not.toContain('categorical')
    },
  )

  it('a named ramp paints every row alike, so the ramp is the key', () => {
    const display = makeDisplay({
      rows: false,
      mark: 'rect',
      displayConfig: {
        encoding: { color: { scale: { type: 'linear', scheme: 'viridis' } } },
        rowColor: { scale: { domain: ['a', 'b'], range: ['red', 'blue'] } },
      },
    })
    expect(display.scoreGradientPaints).toBe(true)
    expect(display.colorScales.map(s => s.kind)).not.toContain('categorical')
  })
})
