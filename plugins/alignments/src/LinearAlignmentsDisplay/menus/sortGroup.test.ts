import { getSortMenuItem } from './sortGroup.ts'

import type {
  ColumnSortType,
  LayoutOrder,
  SortColumn,
} from '../../shared/types.ts'

// A stub of the slice of the display model the sort menu reads/writes, so the
// writes and the derived `checked` state are pinned without a real view.
function makeModel(init?: {
  sortColumn?: SortColumn
  layoutOrder?: LayoutOrder
}) {
  return {
    sortColumn: init?.sortColumn,
    layoutOrder: init?.layoutOrder ?? 'position',
    setSort: jest.fn(),
    sortAtCenterLine: jest.fn(),
  }
}

function radios(model: ReturnType<typeof makeModel>) {
  return getSortMenuItem(model).subMenu
}

function radio(model: ReturnType<typeof makeModel>, label: string) {
  const item = radios(model).find(i => i.label === label)
  if (!item) {
    throw new Error(`no sort radio labeled "${label}"`)
  }
  return item
}

function sorted(type: ColumnSortType): SortColumn {
  return { type, pos: 100, refName: 'chr1' }
}

const LABELS = [
  'Start location',
  'Longest reads first',
  'Spliced reads first',
  'Split reads first',
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
  test('default (no sort, position order) selects Start location', () => {
    expect(checkedLabel(makeModel())).toEqual(['Start location'])
  })

  test.each([
    ['length', 'Longest reads first'],
    ['spliced', 'Spliced reads first'],
    ['split', 'Split reads first'],
  ] as const)('layoutOrder %s selects "%s"', (layoutOrder, label) => {
    expect(checkedLabel(makeModel({ layoutOrder }))).toEqual([label])
  })

  test.each([
    ['strand', 'Read strand'],
    ['basePair', 'Base pair'],
    ['tag', 'Tag...'],
  ] as const)('a %s sort selects "%s"', (type, label) => {
    expect(checkedLabel(makeModel({ sortColumn: sorted(type) }))).toEqual([
      label,
    ])
  })

  test.each(['insertion', 'softclip', 'hardclip'] as const)(
    'a context-menu %s sort keeps "Base pair" checked',
    type => {
      expect(checkedLabel(makeModel({ sortColumn: sorted(type) }))).toEqual([
        'Base pair',
      ])
    },
  )

  // Like the color menu's tag radio: the tag in use is otherwise invisible
  // without reopening the dialog.
  test('the tag radio names the tag being sorted on', () => {
    const model = makeModel({ sortColumn: { ...sorted('tag'), tag: 'HP' } })
    expect(checkedLabel(model)).toEqual(['Tag (HP)...'])
  })

  test('exactly one radio is ever checked', () => {
    for (const model of [
      makeModel(),
      makeModel({ layoutOrder: 'length' }),
      makeModel({ layoutOrder: 'spliced' }),
      makeModel({ layoutOrder: 'split' }),
      makeModel({ sortColumn: sorted('strand') }),
      makeModel({ sortColumn: sorted('basePair') }),
      makeModel({ sortColumn: sorted('tag') }),
    ]) {
      expect(checkedLabel(model)).toHaveLength(1)
    }
    expect(radios(makeModel()).map(i => i.label)).toEqual(LABELS)
  })
})

// LGVSyntenyDisplay passes a curated subset — PAF blocks have no per-base
// sequence to sort a column by and no SAM tags — and its own noun.
describe('curated modes', () => {
  const opts = {
    noun: 'feature',
    modes: ['position', 'length', 'strand'] as const,
  }

  test('offers only the requested modes, in the requested order', () => {
    expect(
      getSortMenuItem(makeModel(), {
        ...opts,
        modes: [...opts.modes],
      }).subMenu.map(i => i.label),
    ).toEqual(['Start location', 'Longest features first', 'Feature strand'])
  })

  // Mirrors the group-by radios, which tick "None" for a stored dimension they
  // don't offer: a blank radio group reads as a broken menu.
  test.each(['basePair', 'tag'] as const)(
    'a stored %s sort this menu does not offer falls back to Start location',
    type => {
      const item = getSortMenuItem(makeModel({ sortColumn: sorted(type) }), {
        ...opts,
        modes: [...opts.modes],
      })
      expect(item.subMenu.filter(i => i.checked).map(i => i.label)).toEqual([
        'Start location',
      ])
    },
  )

  test('still tracks the checked mode', () => {
    const item = getSortMenuItem(makeModel({ layoutOrder: 'length' }), {
      ...opts,
      modes: [...opts.modes],
    })
    expect(item.subMenu.filter(i => i.checked).map(i => i.label)).toEqual([
      'Longest features first',
    ])
  })
})

describe('sort menu writes', () => {
  test.each([
    ['Start location', 'position'],
    ['Longest reads first', 'length'],
    ['Spliced reads first', 'spliced'],
    ['Split reads first', 'split'],
  ])('%s is one setSort(%s) write', (label, order) => {
    const model = makeModel({ layoutOrder: 'length' })
    radio(model, label).onClick()
    expect(model.setSort).toHaveBeenCalledWith(order)
    expect(model.sortAtCenterLine).not.toHaveBeenCalled()
  })

  // A column sort goes through sortAtCenterLine, which writes the slot only once
  // it has a column. Writing here instead would wipe the current ordering even
  // when the sort never lands (no valid center line).
  test.each([
    ['Read strand', 'strand'],
    ['Base pair', 'basePair'],
  ])('%s sorts at the center line without writing the slot', (label, type) => {
    const model = makeModel({ layoutOrder: 'length' })
    radio(model, label).onClick()
    expect(model.sortAtCenterLine).toHaveBeenCalledWith(type)
    expect(model.setSort).not.toHaveBeenCalled()
  })
})
