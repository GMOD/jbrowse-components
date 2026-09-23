import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Driven off a real display instance rather than a structural stand-in: the menu
// is built inline in the model's `trackMenuItems`, and its gates read getters
// (`isRowLayout`, `sourcesWithoutLayout`, `rowTree`) that a stub would have to
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
      'Show legend',
      'Show cross hatches',
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

  it('keeps the menu open on every toggle, like the rest of the app', () => {
    const { display } = makeDisplay()
    const items = subMenuOf(display.trackMenuItems(), 'Show...')

    expect(items.every(i => 'onClick' in i && staysOpenOnClick(i))).toBe(true)
  })

  it('offers only the summary modes density draws, checking the effective one', () => {
    const { display } = makeDisplay({ renderingType: 'density' })
    display.configuration.setSlot('summaryScoreMode', 'whiskers')
    const modes = subMenuOf(
      subMenuOf(display.trackMenuItems(), 'Score'),
      'Summary score mode',
    )

    // whiskers has no density presentation, so offering it would check a mode
    // neither the plot nor the score domain uses — 'avg' is what both do
    expect(labels(modes)).toEqual(['Minimum', 'Maximum', 'Average'])
    expect(
      modes
        .filter(i => 'checked' in i && i.checked)
        .map(i => 'label' in i && i.label),
    ).toEqual(['Average'])
  })

  // The row stays in the menu whatever the rendering — that is what keeps its
  // display-type pin reachable — and greys out where nothing is keyed by
  // colour: one source needs no key, and a faceted track names its sources
  // beside their rows.
  it('enables the legend toggle only where a color key means anything', () => {
    const enabled = (display: { trackMenuItems: () => MenuItem[] }) =>
      !(
        itemIn(
          subMenuOf(display.trackMenuItems(), 'Show...'),
          'Show legend',
        ) as { disabled?: boolean }
      ).disabled

    expect(enabled(makeDisplay({ faceted: false }).display)).toBe(true)
    expect(
      enabled(makeDisplay({ sources: ['a'], faceted: false }).display),
    ).toBe(false)
    expect(enabled(makeDisplay().display)).toBe(false)
  })
})

// The colour route: one row opening the channel-spec box, which replaced the
// bicolor/single radio and the pivot field the display used to carry.
it('offers Edit color... whatever the layout', () => {
  expect(labels(makeDisplay().display.trackMenuItems())).toContain(
    'Edit color...',
  )
  expect(
    labels(makeDisplay({ faceted: false }).display.trackMenuItems()),
  ).toContain('Edit color...')
})
