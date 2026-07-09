import { getSortByMenuItem } from './sortGroup.ts'

import type { SortedBy } from '../../shared/types.ts'

// A stub of the slice of the display model the sort menu reads/writes. The menu
// coordinates two config slots (`sortedBy` and `largeFeaturesFirst`) so the
// pileup never holds two orderings at once; these tests pin that coordination
// and the derived `checked` state without spinning up a real view.
function makeModel(init?: {
  sortedBy?: SortedBy
  largeFeaturesFirst?: boolean
}) {
  return {
    sortedBy: init?.sortedBy,
    largeFeaturesFirst: init?.largeFeaturesFirst ?? false,
    setSortedBy: jest.fn(),
    clearSortedBy: jest.fn(),
    setLargeFeaturesFirst: jest.fn(),
  }
}

function radios(model: ReturnType<typeof makeModel>) {
  return getSortByMenuItem(model).subMenu
}

function radio(model: ReturnType<typeof makeModel>, label: string) {
  const item = radios(model).find(i => i.label === label)
  if (!item) {
    throw new Error(`no sort radio labeled "${label}"`)
  }
  return item
}

function sorted(type: string): SortedBy {
  return { type, pos: 100, refName: 'chr1', assemblyName: 'volvox' }
}

const LABELS = [
  'Start location',
  'Longest reads first',
  'Read strand',
  'Base pair',
  'Tag...',
]

// The one label that reads as checked for a given model state.
function checkedLabel(model: ReturnType<typeof makeModel>) {
  return radios(model)
    .filter(i => i.checked)
    .map(i => i.label)
}

describe('sort menu radio selection', () => {
  test('default (no sort, no largeFeaturesFirst) selects Start location', () => {
    expect(checkedLabel(makeModel())).toEqual(['Start location'])
  })

  test('largeFeaturesFirst selects Longest reads first, not Start location', () => {
    expect(checkedLabel(makeModel({ largeFeaturesFirst: true }))).toEqual([
      'Longest reads first',
    ])
  })

  test.each([
    ['strand', 'Read strand'],
    ['basePair', 'Base pair'],
    ['tag', 'Tag...'],
  ])('a %s sort selects "%s"', (type, label) => {
    expect(checkedLabel(makeModel({ sortedBy: sorted(type) }))).toEqual([label])
  })

  test.each(['insertion', 'softclip', 'hardclip'])(
    'a context-menu %s sort keeps "Base pair" checked',
    type => {
      expect(checkedLabel(makeModel({ sortedBy: sorted(type) }))).toEqual([
        'Base pair',
      ])
    },
  )

  test('exactly one radio is ever checked', () => {
    for (const model of [
      makeModel(),
      makeModel({ largeFeaturesFirst: true }),
      makeModel({ sortedBy: sorted('strand') }),
      makeModel({ sortedBy: sorted('basePair') }),
      makeModel({ sortedBy: sorted('tag') }),
    ]) {
      expect(checkedLabel(model)).toHaveLength(1)
    }
    expect(radios(makeModel()).map(i => i.label)).toEqual(LABELS)
  })
})

describe('sort menu keeps the two ordering slots mutually exclusive', () => {
  test('Start location clears both slots (it is the reset)', () => {
    const model = makeModel({ largeFeaturesFirst: true })
    radio(model, 'Start location').onClick()
    expect(model.setLargeFeaturesFirst).toHaveBeenCalledWith(false)
    expect(model.clearSortedBy).toHaveBeenCalled()
    expect(model.setSortedBy).not.toHaveBeenCalled()
  })

  test('Longest reads first clears the sort before enabling itself', () => {
    const model = makeModel({ sortedBy: sorted('basePair') })
    radio(model, 'Longest reads first').onClick()
    expect(model.clearSortedBy).toHaveBeenCalled()
    expect(model.setLargeFeaturesFirst).toHaveBeenCalledWith(true)
  })

  test.each([
    ['Read strand', 'strand'],
    ['Base pair', 'basePair'],
  ])('%s clears largeFeaturesFirst then sets the sort', (label, type) => {
    const model = makeModel({ largeFeaturesFirst: true })
    radio(model, label).onClick()
    expect(model.setLargeFeaturesFirst).toHaveBeenCalledWith(false)
    expect(model.setSortedBy).toHaveBeenCalledWith(type)
  })
})
