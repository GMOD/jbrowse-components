import { getSortMenuItem } from './sortGroup.ts'

import type {
  ColumnSortField,
  LayoutOrder,
  SortColumn,
} from '../../shared/types.ts'
import type { RadioMenuItem } from '@jbrowse/core/ui'

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

// The radios alone: the center-line rows sit under a sub-header
function radios(model: ReturnType<typeof makeModel>) {
  return getSortMenuItem(model).subMenu.filter(
    (i): i is RadioMenuItem => 'type' in i && i.type === 'radio',
  )
}

function radio(model: ReturnType<typeof makeModel>, label: string) {
  const item = radios(model).find(i => i.label === label)
  if (!item) {
    throw new Error(`no sort radio labeled "${label}"`)
  }
  return item
}

function sorted(field: ColumnSortField): SortColumn {
  return { field, pos: 100, refName: 'chr1' }
}

const LABELS = [
  'Start position',
  'Longest reads first',
  'Spliced reads first',
  'Split reads first',
  'SV evidence first',
  'Strand',
  'Base',
  'Mapping quality',
  'Pair orientation',
  'Tag...',
]

// The one label that reads as checked for a given model state.
function checkedLabel(model: ReturnType<typeof makeModel>) {
  return radios(model)
    .filter(i => i.checked)
    .map(i => i.label)
}

describe('sort menu radio selection', () => {
  test('default (no sort, position order) selects Start position', () => {
    expect(checkedLabel(makeModel())).toEqual(['Start position'])
  })

  test.each([
    ['length', 'Longest reads first'],
    ['spliced', 'Spliced reads first'],
    ['split', 'Split reads first'],
    ['svSignal', 'SV evidence first'],
  ] as const)('layoutOrder %s selects "%s"', (layoutOrder, label) => {
    expect(checkedLabel(makeModel({ layoutOrder }))).toEqual([label])
  })

  test.each([
    ['strand', 'Strand'],
    ['base', 'Base'],
    ['mapq', 'Mapping quality'],
    ['pairOrientation', 'Pair orientation'],
    ['tags.HP', 'Tag...'],
  ] as const)('a %s sort selects "%s"', (type, label) => {
    expect(checkedLabel(makeModel({ sortColumn: sorted(type) }))).toEqual([
      label,
    ])
  })

  test.each(['insertion', 'softclip', 'hardclip'] as const)(
    'a context-menu %s sort keeps "Base" checked',
    type => {
      expect(checkedLabel(makeModel({ sortColumn: sorted(type) }))).toEqual([
        'Base',
      ])
    },
  )

  test('exactly one radio is ever checked', () => {
    for (const model of [
      makeModel(),
      makeModel({ layoutOrder: 'length' }),
      makeModel({ layoutOrder: 'spliced' }),
      makeModel({ layoutOrder: 'split' }),
      makeModel({ sortColumn: sorted('strand') }),
      makeModel({ sortColumn: sorted('base') }),
      makeModel({ sortColumn: sorted('tags.HP') }),
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
      }).subMenu.map(i => ('label' in i ? i.label : '')),
    ).toEqual([
      'Start position',
      'Longest features first',
      'At the center line',
      'Strand',
    ])
  })

  // Mirrors the group-by radios, which tick "None" for a stored dimension they
  // don't offer: a blank radio group reads as a broken menu.
  test.each(['base', 'tags.HP'] as const)(
    'a stored %s sort this menu does not offer falls back to Start position',
    type => {
      const item = getSortMenuItem(makeModel({ sortColumn: sorted(type) }), {
        ...opts,
        modes: [...opts.modes],
      })
      expect(
        item.subMenu.flatMap(i =>
          'checked' in i && i.checked ? [i.label] : [],
        ),
      ).toEqual(['Start position'])
    },
  )

  test('still tracks the checked mode', () => {
    const item = getSortMenuItem(makeModel({ layoutOrder: 'length' }), {
      ...opts,
      modes: [...opts.modes],
    })
    expect(
      item.subMenu.flatMap(i => ('checked' in i && i.checked ? [i.label] : [])),
    ).toEqual(['Longest features first'])
  })
})

describe('sort menu writes', () => {
  test.each([
    ['Start position', 'position'],
    ['Longest reads first', 'length'],
    ['Spliced reads first', 'spliced'],
    ['Split reads first', 'split'],
    ['SV evidence first', 'svSignal'],
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
    ['Strand', 'strand'],
    ['Base', 'base'],
  ])('%s sorts at the center line without writing the slot', (label, type) => {
    const model = makeModel({ layoutOrder: 'length' })
    radio(model, label).onClick()
    expect(model.sortAtCenterLine).toHaveBeenCalledWith(type)
    expect(model.setSort).not.toHaveBeenCalled()
  })
})
