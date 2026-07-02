import { isCallbackValue } from './slotValueUtils.ts'

describe('isCallbackValue', () => {
  test('detects the jexl: prefix', () => {
    expect(isCallbackValue('jexl:1+1')).toBe(true)
    expect(isCallbackValue('red')).toBe(false)
    expect(isCallbackValue(42)).toBe(false)
    expect(isCallbackValue(undefined)).toBe(false)
  })
})
