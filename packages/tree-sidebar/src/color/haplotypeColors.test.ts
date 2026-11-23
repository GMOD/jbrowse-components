import { types } from '@jbrowse/mobx-state-tree'

import { haplotypeRowColors, viewHaplotypeColors } from './haplotypeColors.ts'

import type { HaplotypeColor } from './haplotypeColors.ts'

const WALKS: HaplotypeColor[] = [
  { sample: 'dm6', haplotype: 0, color: 'grey' },
  { sample: 'Canton-S_A1', haplotype: 1, color: 'blue' },
  { sample: 'HG002', haplotype: 1, color: 'orange' },
  { sample: 'HG002', haplotype: 2, color: 'purple' },
  { sample: 'HG005', haplotype: 2, color: 'green' },
]

test('a haplotype row takes the walk of its phase, counted from 1 as PanSN counts', () => {
  const colors = haplotypeRowColors(
    [
      { name: 'Canton-S_A1 HP0', sample: 'Canton-S_A1', phase: 0 },
      { name: 'HG002 HP0', sample: 'HG002', phase: 0 },
      { name: 'HG002 HP1', sample: 'HG002', phase: 1 },
      { name: 'HG005 HP0', sample: 'HG005', phase: 0 },
    ],
    WALKS,
  )
  expect([...colors]).toEqual([
    ['Canton-S_A1 HP0', 'blue'],
    ['HG002 HP0', 'orange'],
    ['HG002 HP1', 'purple'],
  ])
})

test('a sample row takes its walk only where its haplotypes share one color', () => {
  const colors = haplotypeRowColors(
    [
      { name: 'Canton-S_A1', sample: 'Canton-S_A1' },
      { name: 'HG002', sample: 'HG002' },
      { name: 'HG005', sample: 'HG005' },
      { name: 'NA12878', sample: 'NA12878' },
    ],
    WALKS,
  )
  expect([...colors]).toEqual([
    ['Canton-S_A1', 'blue'],
    ['HG005', 'green'],
  ])
})

const Display = types.model({
  haplotypeColors: types.frozen<HaplotypeColor[] | undefined>(),
})

const View = types
  .model({
    tracks: types.array(types.model({ displays: types.array(Display) })),
  })
  .views(() => ({
    get width() {
      return 800
    },
  }))
  .actions(() => ({ setWidth() {} }))

test("a display reads the colors the view's other displays publish, never its own", () => {
  const view = View.create({
    tracks: [
      { displays: [{ haplotypeColors: [WALKS[0]!] }] },
      { displays: [{}] },
      { displays: [{ haplotypeColors: [WALKS[1]!] }] },
    ],
  })
  const reader = view.tracks[2]!.displays[0]!
  expect(viewHaplotypeColors(reader)).toEqual([WALKS[0]])
  expect(viewHaplotypeColors(view.tracks[1]!.displays[0]!)).toEqual([
    WALKS[0],
    WALKS[1],
  ])
})

test('a display in no view reads none', () => {
  expect(viewHaplotypeColors(Display.create({}))).toEqual([])
})
