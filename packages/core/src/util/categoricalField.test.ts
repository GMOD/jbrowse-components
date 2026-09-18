import { NO_VALUE_LABEL, categoricalField } from './categoricalField.ts'
import { NO_CATEGORY_COLOR } from './color/index.ts'

test('a value files under its string, a list joined, and nothing under the empty key', () => {
  const { key } = categoricalField('biotype')
  expect(key('lncRNA')).toBe('lncRNA')
  expect(key(3)).toBe('3')
  expect(key(['a', 'b'])).toBe('a,b')
  expect(key(undefined)).toBe('')
  expect(key(null)).toBe('')
})

test('a feature with no strand is unstranded, so it shares the 0 section and colour', () => {
  const strand = categoricalField('strand')
  expect(strand.key(undefined)).toBe('0')
  expect(strand.key(0)).toBe('0')
  expect(strand.color(strand.key(undefined))).toBe(strand.color('0'))
})

test('strand orders forward, reverse, unstranded unless a domain says otherwise', () => {
  const sorted = (domain?: string[]) =>
    ['-1', '0', '1'].sort(categoricalField('strand', { domain }).compare)
  expect(sorted()).toEqual(['1', '-1', '0'])
  expect(sorted(['-1'])).toEqual(['-1', '0', '1'])
})

test('strand names its values and paints red and blue, and yields each to one written', () => {
  const strand = categoricalField('strand')
  expect(strand.label('-1')).toBe('Reverse strand')
  expect(strand.sectionLabel('1')).toBe('Forward strand')
  expect(strand.color('1')).toBe('tomato')
  expect(strand.color('-1')).toBe('cornflowerblue')
  const repainted = categoricalField('strand', { palette: ['red', 'blue'] })
  expect(repainted.color('1')).toBe('red')
  expect(repainted.domain).toEqual(['1', '-1', '0'])
})

test('any other field names a key as itself in a legend and field: key on a chip', () => {
  const hp = categoricalField('HP')
  expect(hp.label('2')).toBe('2')
  expect(hp.label('')).toBe(NO_VALUE_LABEL)
  expect(hp.sectionLabel('2')).toBe('HP: 2')
  expect(hp.sectionLabel('')).toBe('HP: none')
})

test('the empty key sorts after every value and paints the no-category grey', () => {
  const field = categoricalField('biotype', { domain: ['snoRNA'] })
  expect(['', 'lncRNA', 'snoRNA'].sort(field.compare)).toEqual([
    'snoRNA',
    'lncRNA',
    '',
  ])
  expect(field.color('')).toBe(NO_CATEGORY_COLOR)
})

test("a key's colour depends on the key and the declaration alone", () => {
  const a = categoricalField('biotype', { domain: ['x'] })
  const b = categoricalField('biotype', { domain: ['x'] })
  expect(a.color('y')).toBe(b.color('y'))
  expect(a.color('x')).not.toBe(a.color('y'))
})
