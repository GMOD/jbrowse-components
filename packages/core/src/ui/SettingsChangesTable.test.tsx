import { formatSettingValue } from './SettingsChangesTable.tsx'

test('a short value prints whole', () => {
  expect(formatSettingValue(undefined)).toBe('(default)')
  expect(formatSettingValue('density')).toBe('density')
  expect(formatSettingValue(['b', 'a'])).toBe('["b","a"]')
  expect(formatSettingValue({ type: 'basePair' })).toBe('basePair')
  expect(formatSettingValue({ a: 'One' })).toBe('{"a":"One"}')
  expect(formatSettingValue(7)).toBe('7')
})

// A cohort's row order, a label map over it, and the cluster tree beside it
// would each fill the table with one cell; the count and a glimpse say what the
// setting is without printing every sample.
test('a long list, map or string is summarised by its count and its head', () => {
  const order = Array.from({ length: 2500 }, (_, i) => `NA${i}`)
  expect(formatSettingValue(order)).toBe(
    '2500 values: NA0, NA1, NA2, NA3, NA4, NA5, …',
  )
  expect(
    formatSettingValue(Object.fromEntries(order.map(n => [n, `${n} label`]))),
  ).toBe(
    '2500 entries: NA0: NA0 label, NA1: NA1 label, NA2: NA2 label, NA3: NA3 label, NA4: NA4 label, NA5: NA5 label, …',
  )
  const newick = `(${order.join(',')});`
  expect(formatSettingValue(newick)).toBe(
    `${newick.slice(0, 80)}… (${newick.length} characters)`,
  )
})
