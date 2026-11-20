import { measureText } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { paintLabels } from './paintLabels.ts'

import type { ResolvedLabel } from './labelPositioning.ts'
import type { TextRun } from './paintLabels.ts'

// A monospace face advances every glyph 0.6em, where the Helvetica table puts
// `i` at 0.22em: the worker's width, measured there, backed a monospace export's
// subfeature label for barely a third of its length
test('an overlay label is backed for its whole width in the export font', () => {
  const text = 'iiiiiiiiiiii'
  const fontSize = 11
  const ctx = new SvgCanvas()
  paintLabels(
    ctx,
    [
      {
        kind: 'sub',
        label: {
          text,
          textWidth: measureText(text, fontSize),
          isOverlay: true,
        },
        labelX: 0,
        labelY: 0,
        fontSize,
        color: 'black',
      },
    ],
    fontSize,
    'monospace',
  )
  const svg = ctx.getSerializedSvg()
  const backing = Number(/<rect[^>]* width="([\d.]+)"/.exec(svg)![1])
  expect(backing).toBeGreaterThanOrEqual(text.length * 0.6 * fontSize)
  expect(svg).toMatch(/<text[^>]* font-family="monospace"/)
})

class RunCanvas extends SvgCanvas {
  lines: { runs: readonly TextRun[]; x: number; y: number }[] = []

  fillTextRuns(runs: readonly TextRun[], x: number, y: number) {
    this.lines.push({ runs, x, y })
  }
}

function nameWithBadge(expanded = false): ResolvedLabel[] {
  return [
    {
      kind: 'name',
      label: { text: 'ENST00000357654.9', textWidth: 100 },
      labelX: 10,
      labelY: 20,
      fontSize: 11,
      color: '#000',
    },
    {
      kind: 'more',
      label: { text: '+4 more', textWidth: 40, hidden: 4, expanded },
      labelX: 116,
      labelY: 20,
      color: '#1565c0',
    },
  ]
}

const texts = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1])

// The badge sat at an x measured from the name in the app's font, and a wider
// export face ran a long name into it. Set as one line, the renderer places
// the badge after the name in whatever face it draws.
test('a name and its badge go to a run-setting context as one line', () => {
  const ctx = new RunCanvas()
  paintLabels(ctx, nameWithBadge(), 11)
  expect(ctx.lines).toEqual([
    {
      x: 10,
      y: Math.round(20 + 11 * 0.84),
      runs: [
        {
          text: 'ENST00000357654.9',
          font: '11px sans-serif',
          fillStyle: '#000',
        },
        {
          text: '+4 more',
          font: `italic ${11 * 0.85}px sans-serif`,
          fillStyle: '#1565c0',
        },
      ],
    },
  ])
  expect(texts(ctx.getSerializedSvg())).toEqual([])
})

test('a context without runs draws the badge at its own offset', () => {
  const ctx = new SvgCanvas()
  paintLabels(ctx, nameWithBadge(), 11)
  expect(texts(ctx.getSerializedSvg())).toEqual([
    'ENST00000357654.9',
    '+4 more',
  ])
})

test('an expanded badge draws nothing, so the name stands alone', () => {
  const ctx = new RunCanvas()
  paintLabels(ctx, nameWithBadge(true), 11)
  expect(ctx.lines).toEqual([])
  expect(texts(ctx.getSerializedSvg())).toEqual(['ENST00000357654.9'])
})
