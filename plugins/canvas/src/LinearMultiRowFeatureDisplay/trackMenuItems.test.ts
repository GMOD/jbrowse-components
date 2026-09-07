import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { buildMultiRowTrackMenuItems } from './trackMenuItems.ts'

import type { PartitionRowCount } from './partitionFields.ts'
import type { MultiRowSource } from './rowSources.ts'
import type { LegendItem, MenuItem } from '@jbrowse/core/ui'

// The builder only reads state, so a plain object stands in for the display —
// structural, like `MultiRowMenuSelf`, so a drifted field fails here.
function makeSelf(
  overrides: Partial<
    Parameters<typeof buildMultiRowTrackMenuItems>[0] & {
      rowGroupLegend: LegendItem[]
    }
  > = {},
) {
  const rows: MultiRowSource[] = [{ name: 'a' }, { name: 'b' }]
  const self = {
    showTree: true,
    showLegend: true,
    showLegendDisplayTypeDefault: {
      kind: 'toggle' as const,
      slot: 'showLegend',
      onValue: true,
      active: false,
      toggle: () => {},
    },
    showRowSeparators: false,
    showRowLabels: true,
    setShowRowLabels: () => {},
    colorRowLabels: false,
    setColorRowLabels: () => {},
    effectiveRowHeight: 14,
    colorLegend: [],
    rowGroupLegend: [],
    hiddenCategories: [],
    // Nothing loaded by default, which is the "Partition by..." item's own
    // absent condition.
    effectivePartitionField: 'name',
    partitionCandidates: [] as string[],
    partitionRowCounts: new Map<string, PartitionRowCount>(),
    setPartitionField: () => {},
    showBranchLength: true,
    treeHasBranchLengths: false,
    layout: [],
    rowOrderIsCustom: false,
    editableSources: rows,
    clusterableSources: rows,
    adapterConfig: {},
    colorConfig: undefined,
    setLayoutAndClusterTree: () => {},
    rowHeight: 0,
    setShowTree: () => {},
    setShowLegend: () => {},
    setShowRowSeparators: () => {},
    toggleCategory: () => {},
    setHiddenCategories: () => {},
    setShowBranchLength: () => {},
    setSubtreeFilter: () => {},
    setLayout: () => {},
    clearLayout: () => {},
    willClearTree: () => false,
    setRowHeight: () => {},
    setFitToHeight: () => {},
    ...overrides,
  }
  // Derived rather than defaulted, so a case overriding `hiddenCategories` or
  // either legend cannot leave the derivation behind disagreeing with it.
  return {
    ...self,
    hiddenCategorySet: new Set(self.hiddenCategories),
    hasLegendKey: self.colorLegend.length > 0 || self.rowGroupLegend.length > 0,
  }
}

function labels(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item && 'subMenu' in item) {
    return resolveSubMenu(item)
  } else {
    throw new Error(`submenu "${label}" not found`)
  }
}

// Every label in the menu tree, submenus included.
function allLabels(items: MenuItem[]): string[] {
  return items.flatMap(i =>
    'subMenu' in i
      ? allLabels(resolveSubMenu(i))
      : 'label' in i
        ? [String(i.label)]
        : [],
  )
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
      'Show tree',
      'Tree branch lengths',
      'Show row labels',
      'Show row separators',
      'Color row labels by row color',
    ])
  })

  // The toggle stays clickable when rows are too thin to draw a separator on,
  // so the row height is the only thing that says why nothing happened.
  it('explains the row separator toggle when rows are below the draw threshold', () => {
    const sub = (rowHeight: number) =>
      subMenuOf(
        buildMultiRowTrackMenuItems(
          makeSelf({ effectiveRowHeight: rowHeight }),
        ),
        'Show...',
      ).find(
        i =>
          'label' in i &&
          typeof i.label === 'string' &&
          i.label.startsWith('Show row separators'),
      )

    expect(sub(2)).toMatchObject({
      label: 'Show row separators — needs rows 4px or taller',
    })
    expect(sub(14)).toMatchObject({ label: 'Show row separators' })
  })

  it('keeps the tree controls in one place, not one copy per submenu', () => {
    const items = buildMultiRowTrackMenuItems(
      makeSelf({ treeHasBranchLengths: true }),
    )

    // Both tree toggles live in "Show..." and Clustering emits neither.
    expect(allLabels(items).filter(l => l === 'Tree branch lengths')).toEqual([
      'Tree branch lengths',
    ])
    expect(labels(subMenuOf(items, 'Clustering'))).toEqual([
      'Cluster rows by similarity...',
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

    expect(toggles.every(i => 'onClick' in i && staysOpenOnClick(i))).toBe(true)
    // The dialog opener is the one row that still dismisses.
    const custom = subMenuOf(items, 'Row height').find(
      i => 'label' in i && i.label === 'Custom...',
    )
    expect(custom && 'onClick' in custom && staysOpenOnClick(custom)).toBe(
      false,
    )
  })

  it.each([
    [0, 'Squeeze to fit view'],
    [14, 'Normal'],
    [8, 'Compact'],
    [23, 'Custom...'],
  ])('row height %p checks %p', (rowHeight, expected) => {
    const items = buildMultiRowTrackMenuItems(makeSelf({ rowHeight }))

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

  // The row-group key is drawn under the same `showLegend` slot but is not a
  // category vocabulary, so it contributes no "Categories" submenu — and its
  // ordinary track has an empty colorLegend, so gating "Show legend" on
  // colorLegend alone makes the legend's own "x" a one-way door.
  it('offers "Show legend" for the row-group key with no color key at all', () => {
    const items = buildMultiRowTrackMenuItems(
      makeSelf({
        colorLegend: [],
        rowGroupLegend: [{ label: 'Wolf', color: '#377eb8' }],
      }),
    )

    expect(labels(subMenuOf(items, 'Show...'))).toContain('Show legend')
    expect(labels(items)).not.toContain('Categories')
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

  it('keeps a way back when the legend itself has gone away', () => {
    // buildColorLegend gives up past MAX_LEGEND_ENTRIES distinct colors, so a
    // region loading in can take the color key and every toggle with it away
    // from a user who has already hidden something — and the hidden set stays
    // in the session and re-applies later.
    const items = buildMultiRowTrackMenuItems(
      makeSelf({ colorLegend: [], hiddenCategories: ['quiescent'] }),
    )

    expect(labels(subMenuOf(items, 'Categories (1 hidden)'))).toEqual([
      'Show all categories',
    ])
  })

  it('resets the row order after any of the three reorders wrote a layout', () => {
    expect(labels(buildMultiRowTrackMenuItems(makeSelf()))).not.toContain(
      'Reset row order',
    )
    const reordered = buildMultiRowTrackMenuItems(
      makeSelf({ layout: [{ name: 'b' }], rowOrderIsCustom: true }),
    )
    expect(labels(reordered)).toContain('Reset row order')
    expect(reordered.every(i => 'icon' in i && i.icon)).toBe(true)
  })

  it('disables clustering until there are two rows to cluster', () => {
    const oneRow = subMenuOf(
      buildMultiRowTrackMenuItems(
        makeSelf({ clusterableSources: [{ name: 'a' }] }),
      ),
      'Clustering',
    )[0]!

    expect(oneRow).toMatchObject({
      label: 'Cluster rows by similarity...',
      disabled: true,
      disabledHelpText: 'Needs at least two rows to cluster',
    })
  })

  // The options are discovered from the loaded features, so an unloaded track
  // offers no submenu rather than a stale list.
  describe('partition', () => {
    it('offers nothing until the data says what the columns are', () => {
      expect(labels(buildMultiRowTrackMenuItems(makeSelf()))).not.toContain(
        'Partition by...',
      )
    })

    it('radios the discovered names, checking the one in force', () => {
      const items = subMenuOf(
        buildMultiRowTrackMenuItems(
          makeSelf({
            partitionCandidates: ['repClass', 'repFamily'],
            effectivePartitionField: 'repClass',
          }),
        ),
        'Partition by...',
      )
      expect(items).toMatchObject([
        { label: 'repClass', type: 'radio', checked: true },
        { label: 'repFamily', type: 'radio', checked: false },
      ])
    })

    // The one fact a reader needs at the point of choice: whether a name is
    // twenty rows or one row per feature.
    it('says how many rows each name would draw', () => {
      const items = subMenuOf(
        buildMultiRowTrackMenuItems(
          makeSelf({
            partitionCandidates: ['name', 'repClass', 'strain'],
            effectivePartitionField: 'repClass',
            partitionRowCounts: new Map<string, PartitionRowCount>([
              ['name', { count: 200, overflow: true }],
              ['repClass', { count: 21, overflow: false }],
              ['strain', { count: 1, overflow: false }],
            ]),
          }),
        ),
        'Partition by...',
      )
      expect(items.map(i => ('label' in i ? i.label : ''))).toEqual([
        'name — 200+ rows',
        'repClass — 21 rows',
        'strain — 1 row',
      ])
    })

    it('writes the picked name through the model', () => {
      const picked: string[] = []
      const items = subMenuOf(
        buildMultiRowTrackMenuItems(
          makeSelf({
            partitionCandidates: ['repClass', 'repFamily'],
            effectivePartitionField: 'repClass',
            setPartitionField: (f: string) => {
              picked.push(f)
            },
          }),
        ),
        'Partition by...',
      )
      const family = items.find(i => 'label' in i && i.label === 'repFamily')!
      ;(family as { onClick: () => void }).onClick()
      expect(picked).toEqual(['repFamily'])
    })

    // A jexl partition matches no radio, and saying nothing would leave the
    // submenu looking like the partition was unset.
    it('names a jexl partition rather than leaving it unrepresented', () => {
      const items = subMenuOf(
        buildMultiRowTrackMenuItems(
          makeSelf({
            partitionCandidates: ['name'],
            effectivePartitionField: "jexl:split(feature.name,'#')[1]",
          }),
        ),
        'Partition by...',
      )
      expect(items[0]).toMatchObject({
        label: 'Custom expression',
        disabled: true,
      })
      expect(items.filter(i => 'checked' in i && i.checked)).toHaveLength(0)
    })
  })
})
