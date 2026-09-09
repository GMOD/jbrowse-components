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
  const { sections } = legendSpecOf([svType])
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

// A lone section draws no title, so a ramp that is the whole key carries its
// own name on its row: a bar labelled 0 and 1,200 with nothing saying what is
// being counted is not a key.
test('a lone ramp names itself on its row, with the domain ends formatted', () => {
  const { sections } = legendSpecOf([contacts])
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
            maxLabel: '1,200',
          },
        },
      ],
    },
  ])
})

test('beside another section a ramp leaves the naming to its section title', () => {
  const { sections } = legendSpecOf([svType, contacts])
  expect(sections![1]!.items[0]!.label).toBe('')
  expect(legendEntries({ sections }).map(e => e.label)).toEqual([
    'SV type',
    'Deletion',
    'Duplication',
    '+3 more',
    'Contacts',
    '',
  ])
})

test('a ramp prints its domain through its own format', () => {
  const { sections } = legendSpecOf([
    { ...contacts, domain: [0, 1], format: v => `${v * 100}%` },
  ])
  expect(sections![0]!.items[0]!.gradient).toMatchObject({
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
    spec.sections![1]!.items[0]!.gradient,
  )
})

test('an empty categorical scale is no key; a ramp always is', () => {
  expect(colorScaleIsEmpty({ ...svType, entries: [] })).toBe(true)
  expect(colorScaleIsEmpty(svType)).toBe(false)
  expect(colorScaleIsEmpty(contacts)).toBe(false)
})
