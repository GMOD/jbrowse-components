import { JUNCTION_CLASSES } from './features/sashimi/junctionClass.ts'
import { ARC_SLOT_CATEGORY } from './shaders/palettes.ts'
import { arcClassOf } from './tables.ts'

test('the arcs table names each split arc class, an insertion included', () => {
  expect(
    Object.fromEntries(ARC_SLOT_CATEGORY.map(c => [c, arcClassOf(c)])),
  ).toEqual({
    normalInsert: '',
    longInsert: '',
    shortInsert: '',
    interchrom: '',
    pairLL: '',
    pairRR: '',
    pairRL: '',
    splitForward: 'deletion',
    splitBack: 'duplication',
    splitInvLL: 'inversion',
    splitInvRR: 'inversion',
    splitInsertion: 'insertion',
  })
})

test('the junction table keeps the four sashimi classes', () => {
  expect(JUNCTION_CLASSES).toEqual([
    'splice',
    'deletion',
    'duplication',
    'inversion',
  ])
})
