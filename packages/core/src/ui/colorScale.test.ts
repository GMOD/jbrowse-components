import { colorScaleIsEmpty, legendSpecOf } from './colorScale.ts'
import { legendEntries } from './legendSpec.ts'

import type { CategoricalScale, RampScale } from './colorScale.ts'

const svType: CategoricalScale = {
  kind: 'categorical',
  id: 'svType',
  title: 'SV type',
  entries: [
    { value: 'DEL', label: 'Deletion', color: 'red' },
    { value: 'DUP', label: 'Duplication', color: 'blue', hidden: true },
    { value: '', label: '+3 more' },
  ],
}

const contacts: RampScale = {
  kind: 'ramp',
  id: 'contacts',
  title: 'Contacts',
  domain: [0, 1200],
  stops: [
    { offset: 0, color: 'rgb(255,255,255)', opacity: 0 },
    { offset: 1, color: 'rgb(255,0,0)' },
  ],
}

test('a categorical scale is one section, its entries the rows', () => {
  const { title, sections } = legendSpecOf([svType])
  expect(title).toBe('SV type')
  expect(sections).toEqual([
    {
      id: 'svType',
      title: 'SV type',
      items: [
        { value: 'DEL', label: 'Deletion', color: 'red' },
        { value: 'DUP', label: 'Duplication', color: 'blue', hidden: true },
        { value: '', label: '+3 more' },
      ],
    },
  ])
})

test('a scale whose values name rows says so on its section', () => {
  const { sections } = legendSpecOf([{ ...svType, focusesRows: true }])
  expect(sections[0]?.focusesRows).toBe(true)
  expect(legendSpecOf([svType]).sections[0]?.focusesRows).toBeUndefined()
})

// A lone section draws no title of its own, so a lone categorical scale
// titles the box and a lone ramp carries its name on its row: a bar labelled 0 and 1200 with nothing saying what is
// being counted is not a key.
test('a lone ramp names itself on its row, with the domain ends formatted', () => {
  const { title, sections } = legendSpecOf([contacts])
  expect(title).toBeUndefined()
  expect(sections).toEqual([
    {
      id: 'contacts',
      title: 'Contacts',
      items: [
        {
          label: 'Contacts',
          gradient: {
            stops: contacts.stops,
            minLabel: '0',
            maxLabel: '1200',
          },
        },
      ],
    },
  ])
})

// An empty scale draws no section, so the one beside it is the only thing on
// screen and has to name itself — the section title it would have shown
// beside a sibling is never drawn.
test('an empty sibling scale leaves the other one lone, and titled', () => {
  const empty: CategoricalScale = {
    kind: 'categorical',
    id: 'groups',
    title: 'Groups',
    entries: [],
  }
  const spec = legendSpecOf([svType, empty])
  expect(spec.title).toBe('SV type')
  expect(spec.sections.map(s => s.id)).toEqual(['svType'])
  expect(legendSpecOf([empty, contacts]).sections[0]!.items[0]!.label).toBe(
    'Contacts',
  )
})

// Hi-C's maximum is a percentile of the counts and a mark ramp's is the data's
// own extent, so an end label prints through formatScore or it prints the
// float — 0 and 24.429380416870117 met with no gap between them on screen.
test('a domain measured off the data prints rounded ends', () => {
  const { sections } = legendSpecOf([
    { ...contacts, domain: [0, 24.429380416870117] },
  ])
  expect(sections[0]?.items[0]?.gradient).toEqual({
    stops: contacts.stops,
    minLabel: '0',
    maxLabel: '24.4',
  })
})

test('beside another section a ramp leaves the naming to its section title', () => {
  const { title, sections } = legendSpecOf([svType, contacts])
  expect(title).toBeUndefined()
  expect(sections[1]!.items[0]!.label).toBe('')
  expect(legendEntries({ sections }).map(e => e.label)).toEqual([
    'SV type',
    'Deletion',
    'Duplication',
    '+3 more',
    'Contacts',
    '',
  ])
})

// A pinned end the loaded values run past paints them all in its end colour,
// so the key says the end holds more than its number.
test('an end the data runs past prints as a bound', () => {
  const gradient = (extent: [number, number]) =>
    legendSpecOf([{ ...contacts, domain: [0, 10], extent }]).sections[0]!
      .items[0]!.gradient
  expect(gradient([0, 10])).toMatchObject({ minLabel: '0', maxLabel: '10' })
  expect(gradient([-2, 40])).toMatchObject({
    minLabel: '≤0',
    maxLabel: '≥10',
  })
})

// A value lane holds the extent at float32, where 0.3 reads a hair over the
// 0.3 a config pinned: that meets the end rather than passing it.
test('an extent meeting a pinned end at float32 prints no bound', () => {
  const [gradient] = legendSpecOf([
    {
      ...contacts,
      domain: [0.1, 0.3],
      extent: [Math.fround(0.1), Math.fround(0.3)],
    },
  ]).sections[0]!.items
  expect(gradient!.gradient).toMatchObject({ minLabel: '0.1', maxLabel: '0.3' })
})

test('a ramp prints its domain through its own format', () => {
  const { sections } = legendSpecOf([
    { ...contacts, domain: [0, 1], format: v => `${v * 100}%` },
  ])
  expect(sections[0]!.items[0]!.gradient).toMatchObject({
    minLabel: '0%',
    maxLabel: '100%',
  })
})

test('the export flattens the same sections the screen draws', () => {
  const spec = legendSpecOf([svType, contacts])
  expect(legendEntries(spec).map(e => e.key)).toEqual([
    'svType-title',
    'svType-0',
    'svType-1',
    'svType-2',
    'contacts-title',
    'contacts-0',
  ])
  expect(legendEntries(spec).at(-1)!.gradient).toBe(
    spec.sections[1]!.items[0]!.gradient,
  )
})

test('a domain keys the values it lists first, then the rest sorted', () => {
  const { sections } = legendSpecOf([
    {
      ...svType,
      domain: ['DUP', 'INV'],
      entries: [
        { value: 'DEL', label: 'Deletion', color: 'red' },
        { value: '', label: 'No type' },
        { value: 'BND', label: 'Breakend', color: 'green' },
        { value: 'DUP', label: 'Duplication', color: 'blue', hidden: true },
      ],
    },
  ])
  expect(sections[0]!.items.map(i => i.value)).toEqual([
    'DUP',
    'BND',
    'DEL',
    '',
  ])
  expect(sections[0]!.items[0]!.hidden).toBe(true)
})

test('no domain leaves the entries in the order the display built them', () => {
  const declared = svType.entries.map(e => e.value)
  expect(legendSpecOf([svType]).sections[0]!.items.map(i => i.value)).toEqual(
    declared,
  )
  expect(
    legendSpecOf([{ ...svType, domain: [] }]).sections[0]!.items.map(
      i => i.value,
    ),
  ).toEqual(declared)
})

// The multi-sample variant key lists its reference and no-call rows after the
// field's rows, its no-value row among the field's.
test('no domain keeps rows a display lists after its no-value row there', () => {
  const built = [
    { value: 'Benign', label: 'Benign', color: 'blue' },
    { value: '', label: '(no value)', color: 'navy', missing: true },
    { value: 'Reference', label: 'Reference', color: 'grey' },
  ]
  expect(
    legendSpecOf([{ ...svType, entries: built }]).sections[0]!.items,
  ).toEqual(built)
})

test('an empty categorical scale is no key; a ramp always is', () => {
  expect(colorScaleIsEmpty({ ...svType, entries: [] })).toBe(true)
  expect(colorScaleIsEmpty(svType)).toBe(false)
  expect(colorScaleIsEmpty(contacts)).toBe(false)
})

test("a note carries into the section and the export's rows", () => {
  const { sections } = legendSpecOf([{ ...svType, note: 'read this' }])
  expect(sections[0]!.note).toBe('read this')
  expect(legendEntries({ sections })[0]).toEqual({
    key: 'svType-note',
    label: 'read this',
  })
})
