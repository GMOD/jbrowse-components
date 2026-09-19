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

test('the origin moves the cut a threshold with no domain reads', () => {
  const display = makeDisplay(['a'], true)
  display.setOrigin(4)
  expect(display.wiggleColor.pivot).toBe(4)
})
