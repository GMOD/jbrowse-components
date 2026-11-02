import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'

import {
  FIT_ROWS,
  rowHeightOfStep,
  rowsWithStepConfigSchema,
} from './rowsWithStepConfigSchema.ts'

const Display = ConfigurationSchema('StepHost', {
  rows: rowsWithStepConfigSchema,
})

test('the rows fit the track by default', () => {
  const conf = Display.create({})
  expect(readConfObject(conf, ['rows', 'step'])).toBe(FIT_ROWS)
  expect(rowHeightOfStep(FIT_ROWS)).toBe(0)
})

test('a px step reads back as written', () => {
  const conf = Display.create({ rows: { field: 'source', step: 12 } })
  expect(readConfObject(conf, ['rows', 'step'])).toBe(12)
  expect(rowHeightOfStep(12)).toBe(12)
})

test.each([0, -4])('a step of %d is refused, naming fit', step => {
  expect(() => Display.create({ rows: { step } })).toThrow(
    /row height in px, above 0, or "fit"/,
  )
})

test('a row height written as rows.height points at rows.step', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  Display.create({ rows: { height: 12 } })
  expect(warn).toHaveBeenCalledWith(
    expect.stringMatching(/did you mean .*step/),
  )
  warn.mockRestore()
})
