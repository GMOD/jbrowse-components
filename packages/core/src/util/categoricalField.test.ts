import {
  NO_VALUE_LABEL,
  categoricalField,
  dealKeyColors,
  heldSlotsOf,
  keyNames,
} from './categoricalField.ts'
import { NO_CATEGORY_COLOR } from './color/index.ts'

test('a value files under its string, a list joined, and nothing under the empty key', () => {
  const { key } = categoricalField('biotype')
  expect(key('lncRNA')).toBe('lncRNA')
  expect(key(3)).toBe('3')
  expect(key(['a', 'b'])).toBe('a,b')
  expect(key(undefined)).toBe('')
  expect(key(null)).toBe('')
})

test('a feature with no strand is unstranded, so it shares the 0 section and color', () => {
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
  const repainted = categoricalField('strand', { range: ['red', 'blue'] })
  expect(repainted.color('1')).toBe('red')
  expect(repainted.domain).toEqual(['1', '-1', '0'])
})

test("a declared order leaves strand's colors on their own values", () => {
  for (const domain of [['-1'], ['-1', '1'], ['0', '-1', '1']]) {
    const strand = categoricalField('strand', { domain })
    expect(strand.color('1')).toBe('tomato')
    expect(strand.color('-1')).toBe('cornflowerblue')
    expect(strand.color('0')).toBe('goldenrod')
  }
})

test('svType paints each class its one color and files a non-SV record under the empty key', () => {
  const sv = categoricalField('svType')
  expect(sv.color('DEL')).toBe('#e41a1c')
  expect(sv.color('DUP')).toBe('#377eb8')
  expect(sv.label('BND')).toBe('Breakend / translocation')
  expect(sv.key(undefined)).toBe('')
  expect(sv.label('')).toBe(NO_VALUE_LABEL)
  expect(sv.color('')).toBe(NO_CATEGORY_COLOR)
  expect(['OTHER', 'INS', 'DEL'].sort(sv.compare)).toEqual([
    'DEL',
    'INS',
    'OTHER',
  ])
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

test("a key's color depends on the key and the declaration alone", () => {
  const a = categoricalField('biotype', { domain: ['x'] })
  const b = categoricalField('biotype', { domain: ['x'] })
  expect(a.color('y')).toBe(b.color('y'))
  expect(a.color('x')).not.toBe(a.color('y'))
})

// A config writes labels to rename some entries of a key, not all: an empty one
// is a placeholder that leaves its entry named as the data names it.
test('labels name their keys in order, an empty or missing one keeping the own name', () => {
  const names = keyNames(['a', 'b', 'c', 'a'], ['A', '', 'C', 'again'])
  expect([...names]).toEqual([
    ['a', 'A'],
    ['c', 'C'],
  ])
  expect(keyNames([1, -1], ['Forward']).get('1')).toBe('Forward')
  expect(
    categoricalField('group', {
      domain: ['x', 'y'],
      labels: ['', 'Why'],
    }).label('x'),
  ).toBe('x')
})

test("strand's labels pair with strand's own order while no domain is written", () => {
  const strand = categoricalField('strand', { labels: ['Plus', 'Minus'] })
  expect(strand.label('1')).toBe('Plus')
  expect(strand.label('-1')).toBe('Minus')
  expect(strand.label('0')).toBe('No strand')
})

test('a written domain keeps each strand its own color', () => {
  const own = categoricalField('strand')
  const reordered = categoricalField('strand', { domain: ['-1', '1'] })
  expect(reordered.color('-1')).toBe(own.color('-1'))
  expect(reordered.label('-1')).toBe('Reverse strand')
})

test('three biotypes the hash puts on one color paint three colors', () => {
  const field = categoricalField('biotype', { held: new Map() })
  const colors = ['protein_coding', 'snRNA', 'TEC'].map(field.color)
  expect(new Set(colors).size).toBe(3)
})

test('keys met together take the same colors whatever order they arrive in', () => {
  const keys = ['TEC', 'snRNA', 'lncRNA', 'protein_coding', 'miRNA']
  const a = categoricalField('biotype', { held: new Map() })
  const b = categoricalField('biotype', { held: new Map() })
  dealKeyColors(a, keys)
  dealKeyColors(b, [...keys].reverse())
  expect(keys.map(a.color)).toEqual(keys.map(b.color))
})

test('an owner keeps one held map per key until the owner goes', () => {
  const owner = {}
  expect(heldSlotsOf(owner, 'k')).toBe(heldSlotsOf(owner, 'k'))
  expect(heldSlotsOf(owner, 'k')).not.toBe(heldSlotsOf(owner, 'j'))
  expect(heldSlotsOf({}, 'k')).not.toBe(heldSlotsOf(owner, 'k'))
})
