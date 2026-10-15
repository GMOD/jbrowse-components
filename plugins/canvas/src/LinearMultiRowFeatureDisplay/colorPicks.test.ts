import { createTestEnvironment } from './testEnv.ts'

test('Default returns to the config color from a field or a constant', () => {
  const { display } = createTestEnvironment({}).createDisplay()
  display.colorByField('type')
  expect(display.colorByMode).toBe('attribute')
  display.pickDefaultColor()
  expect(display.colorByMode).toBe('default')

  display.setColorValue('teal')
  expect(display.colorByMode).toBe('solid')
  display.pickDefaultColor()
  expect(display.colorByMode).toBe('default')
  expect(display.solidColor).toBeUndefined()
})
