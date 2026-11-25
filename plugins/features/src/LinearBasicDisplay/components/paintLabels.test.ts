import { measureText } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { paintLabels } from './paintLabels.ts'

import type { ResolvedLabel } from './labelPositioning.ts'

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
  [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(m => m[1])

const baseline = Math.round(20 + 11 * 0.84)

// The badge sat at an x measured from the name in the app's font, and a wider
// export face ran a long name into it. Set as one line, the renderer places
// the badge after the name in whatever face it draws.
test('an exported name and its badge are one text, the badge a tspan after a space', () => {
  const ctx = new SvgCanvas()
  paintLabels(ctx, nameWithBadge(), 11)
  expect(ctx.getSerializedSvg()).toContain(
    `<text x="10" y="${baseline}" fill="#000" font-size="11" text-anchor="start">ENST00000357654.9 <tspan fill="#1565c0" font-size="9.35" font-style="italic">+4 more</tspan></text>`,
  )
})

test('a monospace export sets the line in monospace, which the badge inherits', () => {
  const ctx = new SvgCanvas()
  paintLabels(ctx, nameWithBadge(), 11, 'monospace')
  const [line] = [...ctx.getSerializedSvg().matchAll(/<text[^>]*>/g)]
  expect(line?.[0]).toContain('font-family="monospace"')
  expect(ctx.getSerializedSvg()).toContain(
    '<tspan fill="#1565c0" font-size="9.35" font-style="italic">',
  )
})

test('a screen canvas draws the badge at its own offset on the name baseline', () => {
  const ctx = document.createElement('canvas').getContext('2d')!
  const fillText = jest.spyOn(ctx, 'fillText')
  paintLabels(ctx, nameWithBadge(), 11)
  expect(fillText.mock.calls).toEqual([
    ['ENST00000357654.9', 10, baseline],
    ['+4 more', 116, baseline],
  ])
})

test('an expanded badge draws nothing, so the name stands alone', () => {
  const ctx = new SvgCanvas()
  paintLabels(ctx, nameWithBadge(true), 11)
  expect(texts(ctx.getSerializedSvg())).toEqual(['ENST00000357654.9'])
})

// A face wider than the one a label was measured in would carry a label
// placed by its start past the figure's edge; anchored by its end it stops
// there whatever the face.
test('a label moved to the edge is set by its end, the badge ending the line', () => {
  const ctx = new SvgCanvas()
  const [name, badge] = nameWithBadge()
  paintLabels(
    ctx,
    [
      { ...name!, endX: 150 },
      { ...badge!, endX: 200 },
      { ...name!, label: { text: 'UNMOVED', textWidth: 40 }, labelY: 40 },
    ],
    11,
  )
  const svg = ctx.getSerializedSvg()
  expect(svg).toContain(
    `<text x="200" y="${baseline}" fill="#000" font-size="11" text-anchor="end">ENST00000357654.9 <tspan`,
  )
  expect(svg).toMatch(/<text x="10" [^>]*text-anchor="start">UNMOVED</)
})

test('a screen canvas sets a moved name and badge each by its end', () => {
  const ctx = document.createElement('canvas').getContext('2d')!
  const fillText = jest.spyOn(ctx, 'fillText')
  const [name, badge] = nameWithBadge()
  paintLabels(
    ctx,
    [
      { ...name!, endX: 150 },
      { ...badge!, endX: 200 },
    ],
    11,
  )
  expect(fillText.mock.calls).toEqual([
    ['ENST00000357654.9', 150, baseline],
    ['+4 more', 200, baseline],
  ])
  expect(ctx.textAlign).toBe('start')
})
