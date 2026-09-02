import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Driven off a real display instance rather than a structural stand-in: the menu
// is built inline in the model's `trackMenuItems`, and its gates read getters
// (`isOverlay`, `sourcesWithoutLayout`, `clusterTree`) that a stub would have to
// restate — and then wouldn't notice drifting from.
function makeDisplay({
  sources = ['a', 'b'],
  renderingType,
  clusterTree,
  // the tree's leaves, in tree order — hclust's `order` is exactly its newick
  // leaf order, which is what puts leaf i on row i
  leafOrder = ['b', 'a'],
}: {
  sources?: string[]
  renderingType?: string
  clusterTree?: string
  leafOrder?: string[]
} = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, session } = createDisplay()
  display.setRpcData(0, { sources: sources.map(makeSource) })
  if (renderingType) {
    display.setRenderingType(renderingType)
  }
  if (clusterTree) {
    // A real clustered state, not just a tree string: clustering writes the row
    // order and the tree together, and `computeClusterHierarchy` declines to
    // position a tree whose leaves aren't the rows on screen. `leafOrder` is
    // what the run would have persisted as `layout`.
    display.setLayoutAndClusterTree(
      leafOrder.map(name => ({ name })),
      clusterTree,
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

describe('multi-wiggle Clustering submenu', () => {
  it('offers the run item, and the tree toggles sit under Show... in a row mode', () => {
    const { display } = makeDisplay({ renderingType: 'multirowxy' })
    const items = display.trackMenuItems()

    expect(labels(subMenuOf(items, 'Clustering'))).toEqual([
      'Cluster rows by score...',
    ])
    expect(labels(subMenuOf(items, 'Show...'))).toEqual([
      'Show tree',
      'Tree branch lengths',
      'Show row separators',
      'Show row labels',
      'Show cross hatches',
    ])
  })

  it('drops both tree controls in an overlay mode, where no dendrogram draws', () => {
    const { display } = makeDisplay({
      renderingType: 'multixyplot',
      clusterTree: '(b,a);',
    })

    // the tree is hidden because overlay collapses every source onto one row —
    // `hierarchy` is the gate, and these controls follow it
    expect(display.hierarchy).toBeUndefined()
    expect(
      labels(subMenuOf(display.trackMenuItems(), 'Show...')),
    ).not.toContain('Show tree')
    // the reset stays reachable: it resets the row order, which still matters
    // for the row mode the user will switch back to
    expect(labels(display.trackMenuItems())).toContain('Reset row order')
  })

  it('keeps the tree controls once a clustered row mode comes back', () => {
    const { display } = makeDisplay({
      renderingType: 'multixyplot',
      clusterTree: '(b,a);',
    })
    display.setRenderingType('multirowxy')

    expect(display.hierarchy).toBeDefined()
    expect(labels(subMenuOf(display.trackMenuItems(), 'Show...'))).toContain(
      'Show tree',
    )
  })

  it('refuses to cluster a single subtrack instead of opening a dialog that would', () => {
    const { display } = makeDisplay({
      sources: ['a'],
      renderingType: 'multirowxy',
    })
    const item = itemIn(
      subMenuOf(display.trackMenuItems(), 'Clustering'),
      'Cluster rows by score...',
    )

    expect(item).toMatchObject({
      disabled: true,
      disabledHelpText: 'Needs at least two rows to cluster',
    })
  })

  it('refuses to cluster in an overlay mode, which has no rows to reorder', () => {
    const { display } = makeDisplay({ renderingType: 'multixyplot' })
    const item = itemIn(
      subMenuOf(display.trackMenuItems(), 'Clustering'),
      'Cluster rows by score...',
    )

    expect(item).toMatchObject({
      disabled: true,
      disabledHelpText: 'Only available for multi-row rendering types',
    })
  })

  it('offers a way out of a written row order only once there is one', () => {
    const { display } = makeDisplay({ renderingType: 'multirowxy' })
    expect(labels(display.trackMenuItems())).not.toContain('Reset row order')

    // gated on `layout`, not on the tree: the score sort and the arrangement
    // dialog write an order without one, and this is what undoes those too
    display.setLayout([{ name: 'b' }, { name: 'a' }])
    expect(labels(display.trackMenuItems())).toContain('Reset row order')

    const item = itemIn(display.trackMenuItems(), 'Reset row order')
    if ('onClick' in item) {
      item.onClick()
    }
    expect(display.layout).toEqual([])
    expect(display.clusterTree).toBeUndefined()
  })
})

describe('multi-wiggle track menu', () => {
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
    const { display } = makeDisplay({ renderingType: 'multirowxy' })
    const items = subMenuOf(display.trackMenuItems(), 'Show...')

    expect(items.every(i => 'onClick' in i && staysOpenOnClick(i))).toBe(true)
  })

  it('offers only the summary modes density draws, checking the effective one', () => {
    const { display } = makeDisplay({ renderingType: 'multirowdensity' })
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

  it('offers the overlay legend toggle only where a color key means anything', () => {
    const overlay = makeDisplay({ renderingType: 'multixyplot' }).display
    expect(labels(subMenuOf(overlay.trackMenuItems(), 'Show...'))).toContain(
      'Show legend',
    )

    // one source needs no key, and multirow identifies sources by row label
    const oneSource = makeDisplay({
      sources: ['a'],
      renderingType: 'multixyplot',
    }).display
    expect(
      labels(subMenuOf(oneSource.trackMenuItems(), 'Show...')),
    ).not.toContain('Show legend')

    const row = makeDisplay({ renderingType: 'multirowxy' }).display
    expect(labels(subMenuOf(row.trackMenuItems(), 'Show...'))).not.toContain(
      'Show legend',
    )
  })
})
