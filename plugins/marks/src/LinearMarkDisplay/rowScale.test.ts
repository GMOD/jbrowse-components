import { withRowScale } from './rowColors.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { ColorSource } from './markColor.ts'

const FAMILY = features([
  { source: 'mom', start: 0, end: 400, score: 7 },
  { source: 'dad', start: 200, end: 800, score: 9 },
  { source: 'kid', start: 300, end: 600, score: 5 },
])

function loaded(color: unknown, rowColor?: unknown) {
  const { display } = createTestEnvironment({
    marks: [{ mark: 'bar', encoding: { y: 'score', color } }],
    rows: 'source',
    ...(rowColor ? { rowColor } : {}),
  }).createDisplay()
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  return display
}

const keyColors = (display: ReturnType<typeof loaded>) =>
  Object.fromEntries(
    display.legendSpec.sections
      .filter(s => s.id !== 'rowColor')
      .flatMap(s => s.items)
      .map(item => [item.label, item.color]),
  )

it('a color over the rows field paints each row its row color', () => {
  const display = loaded('source', {
    scale: { domain: ['mom', 'dad'], range: ['#0000ff', '#ff0000'] },
  })
  expect(keyColors(display)).toMatchObject({
    mom: 'rgba(0,0,255,1)',
    dad: 'rgba(255,0,0,1)',
  })
})

it("a row color beats the mark's own range, which colors the rows with none", () => {
  const display = loaded(
    {
      field: 'source',
      scale: { domain: ['mom', 'kid'], range: ['#00ff00', '#ffff00'] },
    },
    { scale: { domain: ['mom'], range: ['#0000ff'] } },
  )
  expect(keyColors(display)).toMatchObject({
    mom: 'rgba(0,0,255,1)',
    kid: 'rgba(255,255,0,1)',
  })
})

it('a color over another field keeps its own scale', () => {
  const source: ColorSource = {
    kind: 'categories',
    encoding: {
      field: 'strand',
      scale: 'ordinal',
      domain: ['1'],
      range: ['#00ff00'],
    },
  }
  expect(withRowScale(source, 'source', new Map([['1', '#000']]))).toBe(source)
})

it('a range past the domain keeps dealing its spare colors', () => {
  const out = withRowScale(
    {
      kind: 'categories',
      encoding: {
        field: 'source',
        scale: 'ordinal',
        domain: ['kid'],
        range: ['#ffff00', '#00ffff'],
      },
    },
    'source',
    new Map([['mom', '#0000ff']]),
  )
  expect(out.kind === 'categories' && out.encoding).toMatchObject({
    domain: ['kid', 'mom'],
    range: ['#ffff00', '#0000ff', '#00ffff'],
  })
})

// The key names the written domain by position, so it keeps its order.
it('the key still names each written value', () => {
  const display = loaded(
    {
      field: 'source',
      scale: {
        domain: ['kid', 'mom'],
        range: ['#ffff00', '#00ff00'],
        names: ['Kid', 'Mother'],
      },
    },
    { scale: { domain: ['mom', 'dad'], range: ['#0000ff', '#ff0000'] } },
  )
  expect(keyColors(display)).toMatchObject({
    Kid: 'rgba(255,255,0,1)',
    Mother: 'rgba(0,0,255,1)',
    dad: 'rgba(255,0,0,1)',
  })
})

it('a written value with no color ends the colored run', () => {
  const out = withRowScale(
    {
      kind: 'categories',
      encoding: {
        field: 'source',
        scale: 'ordinal',
        domain: ['mom', 'kid', 'dad'],
        range: ['#00ff00'],
      },
    },
    'source',
    new Map([['dad', '#ff0000']]),
  )
  expect(out.kind === 'categories' && out.encoding).toMatchObject({
    domain: ['mom', 'kid', 'dad'],
    range: ['#00ff00'],
  })
})
