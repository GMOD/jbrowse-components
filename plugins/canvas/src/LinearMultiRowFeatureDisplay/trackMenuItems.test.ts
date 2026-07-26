import { buildMultiRowTrackMenuItems } from './trackMenuItems.ts'

import type { MultiRowSource } from './sourcesLogic.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The builder only reads state (the onClick bodies are what reach the model and
// the session), so a plain object stands in for the display. Structural, like
// the builder's own `MultiRowMenuSelf`, so a drifted field fails here.
function makeSelf(
  overrides: Partial<Parameters<typeof buildMultiRowTrackMenuItems>[0]> = {},
) {
  const rows: MultiRowSource[] = [{ name: 'a' }, { name: 'b' }]
  return {
    showTree: true,
    showLegend: true,
    colorLegend: [],
    hiddenCategories: [],
    showBranchLength: true,
    treeHasBranchLengths: false,
    layout: [],
    editableSources: rows,
    sourcesWithoutLayout: rows,
    rowHeightSetting: 0,
    setShowTree: () => {},
    setShowLegend: () => {},
    toggleCategory: () => {},
    setHiddenCategories: () => {},
    setShowBranchLength: () => {},
    setSubtreeFilter: () => {},
    setLayout: () => {},
    clearLayout: () => {},
    willClearTree: () => false,
    setRowHeight: () => {},
    setFitToHeight: () => {},
    setRunClustering: () => {},
    ...overrides,
  }
}

function labels(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item && 'subMenu' in item) {
    return item.subMenu
  } else {
    throw new Error(`submenu "${label}" not found`)
  }
}

function checkedLabel(items: MenuItem[]) {
  return items.flatMap(i => ('checked' in i && i.checked ? [i.label] : []))
}

describe('multi-row track menu', () => {
  it('groups the visibility toggles under Show... and icons every row', () => {
    const items = buildMultiRowTrackMenuItems(makeSelf())

    expect(labels(items)).toEqual([
      'Show...',
      'Row height',
      'Edit colors/arrangement...',
      'Clustering',
    ])
    expect(items.every(i => 'icon' in i && i.icon)).toBe(true)
    expect(labels(subMenuOf(items, 'Show...'))).toEqual([
      'Show sidebar with tree and labels',
      'Tree branch lengths',
    ])
  })

  it('keeps the menu open for every toggle, so several can be flipped at once', () => {
    const items = buildMultiRowTrackMenuItems(
      makeSelf({
        colorLegend: [
          { label: 'promoter', color: 1 },
          { label: 'enhancer', color: 2 },
        ],
      }),
    )
    const toggles = [
      ...subMenuOf(items, 'Show...'),
      ...subMenuOf(items, 'Categories'),
      ...subMenuOf(items, 'Row height').filter(
        i => !('label' in i && i.label === 'Custom...'),
      ),
    ]

    expect(toggles.every(i => 'keepMenuOpen' in i && i.keepMenuOpen)).toBe(true)
    // the dialog opener is the one row that still dismisses
    expect(
      subMenuOf(items, 'Row height').find(
        i => 'label' in i && i.label === 'Custom...',
      ),
    ).not.toHaveProperty('keepMenuOpen', true)
  })

  it.each([
    [0, 'Squeeze to fit view'],
    [14, 'Normal'],
    [8, 'Compact'],
    [23, 'Custom...'],
  ])('row height %p checks %p', (rowHeightSetting, expected) => {
    const items = buildMultiRowTrackMenuItems(makeSelf({ rowHeightSetting }))

    expect(checkedLabel(subMenuOf(items, 'Row height'))).toEqual([expected])
  })

  it('offers the legend and category toggles only once colors are keyed', () => {
    const withoutLegend = buildMultiRowTrackMenuItems(makeSelf())
    expect(labels(withoutLegend)).not.toContain('Categories')
    expect(labels(subMenuOf(withoutLegend, 'Show...'))).not.toContain(
      'Show legend',
    )

    const withLegend = buildMultiRowTrackMenuItems(
      makeSelf({ colorLegend: [{ label: 'promoter', color: 1 }] }),
    )
    expect(labels(withLegend)).toContain('Categories')
    expect(labels(subMenuOf(withLegend, 'Show...'))).toContain('Show legend')
  })

  it('counts hidden categories and offers a way back', () => {
    const items = buildMultiRowTrackMenuItems(
      makeSelf({
        colorLegend: [
          { label: 'promoter', color: 1 },
          { label: 'quiescent', color: 2 },
        ],
        hiddenCategories: ['quiescent'],
      }),
    )

    expect(labels(items)).toContain('Categories (1 hidden)')
    const subMenu = subMenuOf(items, 'Categories (1 hidden)')
    expect(checkedLabel(subMenu)).toEqual(['promoter'])
    expect(labels(subMenu)).toContain('Show all categories')
  })

  it('resets the row order after any of the three reorders wrote a layout', () => {
    expect(labels(buildMultiRowTrackMenuItems(makeSelf()))).not.toContain(
      'Reset row order',
    )
    const reordered = buildMultiRowTrackMenuItems(
      makeSelf({ layout: [{ name: 'b' }] }),
    )
    expect(labels(reordered)).toContain('Reset row order')
    expect(reordered.every(i => 'icon' in i && i.icon)).toBe(true)
  })

  it('disables clustering until there are two rows to cluster', () => {
    const oneRow = subMenuOf(
      buildMultiRowTrackMenuItems(
        makeSelf({ sourcesWithoutLayout: [{ name: 'a' }] }),
      ),
      'Clustering',
    )[0]!

    expect(oneRow).toMatchObject({
      label: 'Cluster rows by similarity',
      disabled: true,
      disabledHelpText: 'Needs at least two rows to cluster',
    })
  })
})
