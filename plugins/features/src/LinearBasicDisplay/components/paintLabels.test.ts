import { measureText } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { paintLabels } from './paintLabels.ts'

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
