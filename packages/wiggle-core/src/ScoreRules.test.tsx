import { renderToString } from 'react-dom/server'

import { ScoreRuleLines } from './ScoreRules.tsx'

import type { ScoreRuleMark } from './scoreRuleMarks.ts'

function render(marks: ScoreRuleMark[], offsetY?: number) {
  return renderToString(
    <svg>
      <ScoreRuleLines marks={marks} width={100} offsetY={offsetY} />
    </svg>,
  )
}

const lineYs = (svg: string) =>
  [...svg.matchAll(/<line[^>]*y1="([\d.]+)"/g)].map(m => Number(m[1]))

// The export path renders these through renderToStaticMarkup, which strips the
// alpha out of an rgba() color — SVG 1.1 fill/stroke take a <color>. Baking the
// alpha into the color string would keep it on screen and lose it in every
// exported figure, silently.
it('keeps the alpha on its own attribute, not in an rgba color', () => {
  const svg = render([{ value: 30, label: '2 copies', y: 10 }])
  expect(svg).toContain('stroke-opacity="0.9"')
  expect(svg).not.toContain('rgba(')
})

// A caption crosses the plot rather than sitting beside it, so it draws the
// same halo the tick labels do. Without one, grey-on-fill is unreadable exactly
// where a rule is most useful — down among the bars it is being compared to.
it('halos the caption against the fill it crosses', () => {
  const svg = render([{ value: 30, label: '2 copies', y: 10 }])
  const text = /<text[^>]*>/.exec(svg)![0]
  expect(text).toContain('paint-order="stroke"')
  expect(text).toContain('stroke-width="2.5"')
  // full alpha, unlike the line it captions
  expect(text).not.toContain('fill-opacity')
})

it('colors the line and its caption together', () => {
  const svg = render([{ value: 30, label: '2 copies', color: 'red', y: 10 }])
  expect(svg).toContain('stroke="red"')
  expect(svg).toContain('fill="red"')
  expect(svg).toContain('2 copies')
})

it('draws no caption for an unlabelled rule', () => {
  expect(render([{ value: 30, y: 10 }])).not.toContain('<text')
})

// The parameter no caller needs yet: the alignments coverage band draws one
// band per group section at its own scrolled top, so whoever wires it up reads
// the same marks through a per-section offset rather than a second mark list.
it('shifts every mark by offsetY', () => {
  const marks = [
    { value: 10, y: 4 },
    { value: 30, y: 12 },
  ]
  expect(lineYs(render(marks))).toEqual([4, 12])
  expect(lineYs(render(marks, 50))).toEqual([54, 62])
})
