import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

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

const BLUE = 'rgba(0,0,255,1)'
const RED = 'rgba(255,0,0,1)'
const YELLOW = 'rgba(255,255,0,1)'
const MOM_DAD = {
  scale: { domain: ['mom', 'dad'], range: ['#0000ff', '#ff0000'] },
}

it('a color over the rows field paints each row its row color', () => {
  expect(keyColors(loaded('source', MOM_DAD))).toMatchObject({
    mom: BLUE,
    dad: RED,
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
  expect(keyColors(display)).toMatchObject({ mom: BLUE, kid: YELLOW })
})

it('a domain written for its order alone still paints the row colors', () => {
  const display = loaded(
    { field: 'source', scale: { domain: ['kid', 'mom', 'dad'] } },
    MOM_DAD,
  )
  expect(keyColors(display)).toMatchObject({ mom: BLUE, dad: RED })
})

// The key names the written domain by position.
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
    MOM_DAD,
  )
  expect(keyColors(display)).toMatchObject({
    Kid: YELLOW,
    Mother: BLUE,
    dad: RED,
  })
})

it('coloring one row leaves the palette colors of the others where they were', () => {
  const before = keyColors(loaded('source'))
  const after = keyColors(
    loaded('source', { scale: { domain: ['mom'], range: ['#0000ff'] } }),
  )
  expect(after.mom).toBe(BLUE)
  expect(after.dad).toBe(before.dad)
  expect(after.kid).toBe(before.kid)
})

it('a row-colored value the domain leaves out keeps its own key row, not Other', () => {
  const display = loaded(
    {
      field: 'source',
      scale: { domain: ['mom'], range: ['#00ff00'], unknown: '#888888' },
    },
    { scale: { domain: ['kid'], range: ['#ffff00'] } },
  )
  expect(keyColors(display)).toMatchObject({ kid: YELLOW })
})

it('a written range a row color replaces is named in the corner', () => {
  const display = loaded(
    {
      field: 'source',
      scale: { domain: ['mom', 'kid'], range: ['#00ff00', '#ffff00'] },
    },
    { scale: { domain: ['mom'], range: ['#0000ff'] } },
  )
  expect(display.cornerNotices).toContainEqual(
    expect.stringContaining('mom paint their row colors'),
  )
  expect(
    loaded('source', MOM_DAD).cornerNotices.some(n => n.includes('row colors')),
  ).toBe(false)
})
