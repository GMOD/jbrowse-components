import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

const { createDisplay } = createTestEnvironment()

test('the filter floors ride to the worker as call settings', () => {
  const { display } = createDisplay()
  expect(display.rpcProps().floors).toEqual({
    observed: undefined,
    control: undefined,
  })
  setConf(display, 'filter', [
    { field: 'control', gte: 5 },
    { field: 'observed', gt: 1 },
  ])
  expect(display.rpcProps().floors).toEqual({
    observed: { min: 1, strict: true },
    control: { min: 5, strict: false },
  })
})

test('a filter the worker cannot apply reaches the corner and Edit plot alike', () => {
  const { display } = createDisplay()
  setConf(display, 'filter', [
    { field: 'distance', gte: 2 },
    { field: 'observed', lt: 100 },
  ])
  expect(display.notices).toEqual([
    'filter: no field "distance"; it takes observed, control',
    'filter: observed takes gte or gt, not {"field":"observed","lt":100}',
  ])
  expect(display.plotProblems(display.plot)).toEqual(display.notices)
})

test('a control floor says it reads nothing until the field is observed/control', () => {
  const { display } = createDisplay()
  setConf(display, 'filter', [{ field: 'control', gte: 5 }])
  expect(display.notices).toEqual([
    "filter: control is the control map's count, which only an encoding.color.field of observed/control reads",
  ])
  display.colorByField('observed/control')
  expect(display.notices).toEqual([])
})
