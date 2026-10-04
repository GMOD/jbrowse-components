import { ldMetricLabel, ldValueText } from './ldValueLabel.ts'

test('the label says what the number is', () => {
  expect(ldMetricLabel('r2')).toBe('R²')
  expect(ldMetricLabel('dprime')).toBe("D'")
})

test('a value prints to three places', () => {
  expect(ldValueText(1)).toBe('1.000')
  expect(ldValueText(0.123456)).toBe('0.123')
  expect(ldValueText(0)).toBe('0.000')
})
