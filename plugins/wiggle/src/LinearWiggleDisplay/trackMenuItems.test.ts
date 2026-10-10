import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Driven off a real display instance rather than a structural stand-in: the menu
// is built inline in the model's `trackMenuItems`, and its gates read getters
// (`isRowLayout`, `discoveredRows`, `rowTree`) that a stub would have to
// restate — and then wouldn't notice drifting from.
function makeDisplay({
  sources = ['a', 'b'],
  renderingType,
  faceted = true,
  clusterTree,
  // the tree's leaves, in tree order — hclust's `order` is exactly its newick
  // leaf order, which is what puts leaf i on row i
  leafOrder = ['b', 'a'],
}: {
  sources?: string[]
  renderingType?: string
  faceted?: boolean
  clusterTree?: string
  leafOrder?: string[]
} = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, session, view } = createDisplay()
  display.setRpcData(
    0,
    { sources: sources.map(makeSource) },
    view.displayedRegions[0],
  )
  if (renderingType) {
    display.setRenderingType(renderingType)
  }
  display.setRowLayout(faceted)
  if (clusterTree) {
    // A real clustered state, not just a tree string: clustering writes the row
    // order and the tree together, and `computeClusterHierarchy` declines to
    // position a tree whose leaves aren't the rows on screen. `leafOrder` is
    // what the run would have persisted as `layout`.
    display.setRowOrder(
      leafOrder.map(name => ({ name })),
      { tree: clusterTree },
    )
  }
  return { display, session }
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

function itemIn(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item) {
    return item
  } else {
    throw new Error(`item "${label}" not found`)
  }
}

describe('the wiggle display Clustering submenu', () => {
  it('offers the run item, and the tree toggles sit under Show... in a row mode', () => {
    const { display } = makeDisplay()
    const items = display.trackMenuItems()

    expect(labels(subMenuOf(items, 'Clustering'))).toEqual([
      'Cluster rows by score...',
    ])
    expect(labels(subMenuOf(items, 'Show...'))).toEqual([
      'Show tree',
      'Tree branch lengths',
      'Show row separators',
      'Show row labels',
    ])
  })

  it('drops the tree controls where the sources share one plot', () => {
    const { display } = makeDisplay({
      faceted: false,
      clusterTree: '(b,a);',
    })

    // the tree is hidden because one plot box is one row — `hierarchy` is the
    // gate, and these controls follow it
    expect(display.hierarchy).toBeUndefined()
    expect(
      labels(subMenuOf(display.trackMenuItems(), 'Show...')),
    ).not.toContain('Show tree')
  })

  it('keeps the tree controls once a clustered row mode comes back', () => {
    const { display } = makeDisplay({
      faceted: false,
      clusterTree: '(b,a);',
    })
    display.setRowLayout(true)

    expect(display.hierarchy).toBeDefined()
    expect(labels(subMenuOf(display.trackMenuItems(), 'Show...'))).toContain(
      'Show tree',
    )
  })

  it('refuses to cluster a single subtrack instead of opening a dialog that would', () => {
    const { display } = makeDisplay({ sources: ['a'] })
    const item = itemIn(
      subMenuOf(display.trackMenuItems(), 'Clustering'),
      'Cluster rows by score...',
    )

    expect(item).toMatchObject({
      disabled: true,
      disabledHelpText: 'Needs at least two rows to cluster',
    })
  })

  // Nothing to order until the sources are on rows, so the whole row-order half
  // of the menu — the Clustering submenu and the reset beside it — is absent
  // rather than greyed out. A plain quantitative track never grows either.
  it('offers no row order at all where the sources share one plot', () => {
    const { display } = makeDisplay({ faceted: false })
    const items = labels(display.trackMenuItems())

    expect(items).not.toContain('Clustering')
    expect(items).not.toContain('Reset row order')
  })

  it('offers a way out of a written row order only once there is one', () => {
    const { display } = makeDisplay()
    expect(labels(display.trackMenuItems())).not.toContain('Reset row order')

    // gated on `layout`, not on the tree: the score sort and the arrangement
    // dialog write an order without one, and this is what undoes those too
    display.setRowOrder([{ name: 'b' }, { name: 'a' }])
    expect(labels(display.trackMenuItems())).toContain('Reset row order')

    const item = itemIn(display.trackMenuItems(), 'Reset row order')
    if ('onClick' in item) {
      item.onClick()
    }
    expect(display.rowDomain).toEqual([])
    expect(display.rowTree).toBeUndefined()
  })
})

describe('the wiggle display track menu', () => {
  it('opens the color editor on the display itself', () => {
    const { display, session } = makeDisplay()
    const item = itemIn(display.trackMenuItems(), 'Edit colors/arrangement...')
    if ('onClick' in item) {
      item.onClick()
    }

    expect(session.queuedDialogs).toHaveLength(1)
    expect(session.queuedDialogs[0]![1]).toMatchObject({ model: display })
  })

  // The one color row, whatever the track: with subtracks the dialog is the
  // grid, and with one it is the plot's two colors, which the menu used to
  // reach only through a JSON box.
  it('offers the one color row on every track, and offers it live', () => {
    for (const display of [
      makeDisplay().display,
      makeDisplay({ sources: ['a'], faceted: false }).display,
    ]) {
      expect(labels(display.trackMenuItems())).toContain(
        'Edit colors/arrangement...',
      )
      expect(
        itemIn(display.trackMenuItems(), 'Edit colors/arrangement...'),
      ).toMatchObject({ disabled: false })
    }
  })

  // A swatch waits for no row list, and this is the only color route a plain
  // BigWig has — gating it on the rows greyed it out until a fetch landed.
  it('offers it before any subtrack has arrived', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.discoveredRows).toHaveLength(0)
    expect(
      itemIn(display.trackMenuItems(), 'Edit colors/arrangement...'),
    ).toMatchObject({ disabled: false })
  })

  it('keeps the menu open on every toggle, like the rest of the app', () => {
    const { display } = makeDisplay()
    const items = subMenuOf(display.trackMenuItems(), 'Show...')

    expect(items.every(i => 'onClick' in i && staysOpenOnClick(i))).toBe(true)
  })

  it('offers the min and max wherever the plot can draw them', () => {
    const binSummary = (renderingType: string) =>
      subMenuOf(
        subMenuOf(
          makeDisplay({ renderingType }).display.trackMenuItems(),
          'Resolution',
        ),
        'Bin summary',
      )
    const checked = (items: MenuItem[]) =>
      items
        .filter(i => 'checked' in i && i.checked)
        .map(i => 'label' in i && i.label)

    const bars = binSummary('xyplot')
    expect(labels(bars)).toEqual([
      'Minimum',
      'Maximum',
      'Average',
      'Show min and max',
    ])
    expect(checked(bars)).toEqual(['Average', 'Show min and max'])

    // density maps score to color and draws no min and max, so offering them
    // would tick a setting nothing on screen follows
    expect(labels(binSummary('density'))).toEqual([
      'Minimum',
      'Maximum',
      'Average',
    ])
  })

  // One source needs no key, and a faceted track names its sources beside
  // their rows
  it('offers the legend toggle only where a color key means anything', () => {
    const offered = (display: { trackMenuItems: () => MenuItem[] }) => {
      const items = display.trackMenuItems()
      return (
        labels(items).includes('Show...') &&
        labels(subMenuOf(items, 'Show...')).includes('Show legend')
      )
    }

    expect(offered(makeDisplay({ faceted: false }).display)).toBe(true)
    expect(
      offered(makeDisplay({ sources: ['a'], faceted: false }).display),
    ).toBe(false)
    expect(offered(makeDisplay().display)).toBe(false)
  })
})

// Edit plot... holds the color among the other plot settings, so one row in
// the menu says color.
it('names color once in the menu', () => {
  for (const faceted of [true, false]) {
    const said = labels(
      makeDisplay({ faceted }).display.trackMenuItems(),
    ).filter(label => String(label).toLowerCase().includes('color'))

    expect(said).toEqual(['Edit colors/arrangement...'])
  }
})
