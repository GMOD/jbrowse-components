import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { createTestEnvironment, makeSource } from './testEnv.ts'

function makeDisplay(names: string[], faceted: boolean) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setFaceted(faceted)
  display.setRpcData(
    0,
    { sources: names.map(n => makeSource(n)) },
    view.displayedRegions[0],
  )
  return display
}

test('a row per source defaults to the pos/neg pair about the origin', () => {
  const display = makeDisplay(['a', 'b'], true)
  expect(display.effectiveColor.field).toBe('score')
  expect(display.wiggleColor).toEqual({
    posColor: WIGGLE_POS_COLOR_DEFAULT,
    negColor: WIGGLE_NEG_COLOR_DEFAULT,
    pivot: 0,
    rampLut: null,
    perSource: false,
  })
})

test('one source in a shared plot keeps the pair, several take a colour each', () => {
  expect(makeDisplay(['a'], false).wiggleColor.perSource).toBe(false)
  expect(makeDisplay(['a', 'b'], false).wiggleColor.perSource).toBe(true)
})

test('a written colour wins over the layout, whatever it is', () => {
  const display = makeDisplay(['a', 'b'], false)
  display.setColor('green')
  expect(display.wiggleColor.perSource).toBe(false)
  expect(display.wiggleColor.posColor).toBe('green')
})

// The circular view's key reads this member off whatever display a ring is
// (`CircularLegendSource`), so a rename here empties the key rather than
// failing a build there.
test('the circular key reads the colour the plot paints', () => {
  const display = makeDisplay(['a'], true)
  expect(display.legendColor).toBe(WIGGLE_POS_COLOR_DEFAULT)
  display.setColor('green')
  expect(display.legendColor).toBe('green')
})

test('the origin moves the cut a threshold with no domain reads', () => {
  const display = makeDisplay(['a'], true)
  display.setOrigin(4)
  expect(display.wiggleColor.pivot).toBe(4)
})

test('a declared threshold draws a key, the layout default draws none', () => {
  const display = makeDisplay(['a'], true)
  expect(display.colorScales.map(s => s.id)).not.toContain('threshold')

  display.setColor({
    field: 'score',
    scale: 'threshold',
    domain: ['2'],
    palette: ['#2166ac', '#b2182b'],
  })
  const key = display.colorScales.find(s => s.id === 'threshold')
  expect(key?.kind).toBe('categorical')
  expect(key?.kind === 'categorical' && key.entries).toEqual([
    { value: '< 2', label: '< 2', color: '#2166ac' },
    { value: '\u2265 2', label: '\u2265 2', color: '#b2182b' },
  ])
})

test('the spec reads back what was written', () => {
  const display = makeDisplay(['a'], true)
  display.setColor({ field: 'score', scale: 'linear', ramp: ['viridis'] })
  expect(display.channelSpec.color).toEqual({
    field: 'score',
    scale: 'linear',
    ramp: ['viridis'],
  })
  display.setColor('green')
  expect(display.channelSpec.color).toBe('green')
})
