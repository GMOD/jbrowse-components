import {
  ConfigurationSchema,
  readConfObject,
  refusingUndeclaredKeys,
  setConf,
} from '@jbrowse/core/configuration'
import { FIT_ROWS } from '@jbrowse/core/util/resolveRowHeight'

import { rowsWithStepConfigSchema } from './rowsWithStepConfigSchema.ts'

const Display = ConfigurationSchema(
  'StepHost',
  { rows: rowsWithStepConfigSchema },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

function warningsOf(load: () => unknown) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  load()
  const warnings = spy.mock.calls.map(([message]) => message)
  spy.mockRestore()
  return warnings
}

test('the rows fit the track by default', () => {
  const conf = Display.create({ displayId: 'fit' })
  expect(readConfObject(conf, ['rows', 'step'])).toBe(FIT_ROWS)
})

test('a px step reads back as written', () => {
  const conf = Display.create({
    displayId: 'px',
    rows: { field: 'source', step: 12 },
  })
  expect(readConfObject(conf, ['rows', 'step'])).toBe(12)
})

test.each([0, -4])('a step of %d loads as fit, named once', step => {
  let conf = Display.create({ displayId: 'a' })
  const warnings = warningsOf(() => {
    conf = Display.create({ displayId: 'b', rows: { step } })
    Display.create({ displayId: 'c', rows: { step } })
  })
  expect(readConfObject(conf, ['rows', 'step'])).toBe(FIT_ROWS)
  expect(warnings).toEqual([
    `RowsWithStep.step takes a number above 0 or "fit", not ${step}: loading the default, "fit"`,
  ])
})

test.each([0, -4])(
  'a step of %d written whole is refused, naming fit',
  step => {
    const conf = Display.create({ displayId: 'whole' })
    expect(() => {
      setConf(conf, 'rows', { step })
    }).toThrow(
      `rows.step takes a number above 0 or "fit", not ${step} — row height in px`,
    )
    expect(() =>
      refusingUndeclaredKeys(() =>
        Display.create({ displayId: 'w', rows: { step } }),
      ),
    ).toThrow(/^RowsWithStep\.step takes a number above 0 or "fit", not/)
  },
)

test.each([0, -4])('a step of %d written as a member is refused', step => {
  const conf = Display.create({ displayId: 'member', rows: { step: 8 } })
  expect(() => {
    setConf(conf, ['rows', 'step'], step)
  }).toThrow(
    `rows.step takes a number above 0 or "fit", not ${step} — row height in px`,
  )
  expect(readConfObject(conf, ['rows', 'step'])).toBe(8)
})

test('a row height written as rows.height points at rows.step', () => {
  expect(
    warningsOf(() => Display.create({ displayId: 'h', rows: { height: 12 } })),
  ).toEqual([
    'RowsWithStep does not declare height: loading without it — did you mean step?',
  ])
  const conf = Display.create({ displayId: 'set' })
  expect(() => {
    setConf(conf, 'rows', { height: 12 })
  }).toThrow(/not height — did you mean rows\.step\?$/)
  expect(() => {
    // @ts-expect-error a misnamed word is no slot
    setConf(conf, ['rows', 'height'], 12)
  }).toThrow(/— did you mean rows\.step\?$/)
})
