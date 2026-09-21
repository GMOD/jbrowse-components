import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import {
  displayCanShowCigar,
  navigationMenuItems,
  rowMenuItems,
} from './menus.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const SHOW_ALL_REGIONS_LABELS = [
  'Show all regions - each row fit to width',
  'Show all regions - same bp per pixel',
]

describe('navigationMenuItems', () => {
  function build(
    state: Partial<{
      sameScale: boolean
      followSynteny: boolean
      followAnchorIndex: number
      followMatchOrientation: boolean
    }> = {},
  ) {
    const calls: unknown[] = []
    const items = navigationMenuItems({
      views: [{ assemblyNames: ['hg002mat'] }, { assemblyNames: ['hg002pat'] }],
      sameScale: false,
      followSynteny: false,
      followAnchorIndex: 0,
      followMatchOrientation: false,
      ...state,
      squareView: () => calls.push('square'),
      showAllRegionsAcrossRows: (sameScale: boolean) => {
        calls.push(sameScale ? 'sameScale' : 'fit')
      },
      setFollowSynteny: flag => calls.push(flag),
      setFollowAnchorIndex: idx => calls.push(idx),
      setFollowMatchOrientation: arg => calls.push(['orient', arg]),
    })
    return { items, calls, follow: subMenuOf(items, 'Follow') }
  }

  function subMenuOf(items: MenuItem[], label: string) {
    const item = items.find(i => 'label' in i && i.label === label)
    return item && 'subMenu' in item ? resolveSubMenu(item) : []
  }

  function labelled(items: MenuItem[], label: string) {
    return items.find(
      i => 'label' in i && i.label === label && i.type !== 'subHeader',
    ) as
      | {
          type?: string
          checked?: boolean
          subLabel?: string
          onClick?: () => void
          subMenu?: MenuItem[]
        }
      | undefined
  }

  test('the follow is the one group, and the zoom commands are not in it', () => {
    const { items } = build({ followSynteny: true })
    expect(items.flatMap(i => ('subMenu' in i ? [i.label] : []))).toEqual([
      'Follow',
    ])
  })

  test('the anchor picker opens beside the follow checkbox, not a level deeper', () => {
    const { follow } = build({ followSynteny: true })
    expect(follow.some(i => 'subMenu' in i)).toBe(false)
    expect(
      follow.flatMap(i =>
        i.type === 'subHeader' && 'label' in i ? [i.label] : [],
      ),
    ).toEqual(['Anchor row', 'Orientation'])
  })

  test('the orientation toggle is only offered while following, and flips its own state', () => {
    const label = 'Flip rows to match the anchor - inside inverted alignments'
    expect(labelled(build().follow, label)).toBeUndefined()
    const { follow, calls } = build({
      followSynteny: true,
      followMatchOrientation: true,
    })
    expect(labelled(follow, label)?.checked).toBe(true)
    labelled(follow, label)?.onClick?.()
    expect(calls).toEqual([['orient', false]])
  })

  test('the three zoom commands lead the menu, unheaded', () => {
    const { items, calls } = build()
    expect(items.slice(0, 3).map(i => ('label' in i ? i.label : ''))).toEqual([
      'Square view - average bp per pixel',
      'Show all regions - each row fit to width',
      'Show all regions - same bp per pixel',
    ])
    labelled(items, 'Square view - average bp per pixel')?.onClick?.()
    labelled(items, 'Show all regions - each row fit to width')?.onClick?.()
    labelled(items, 'Show all regions - same bp per pixel')?.onClick?.()
    expect(calls).toEqual(['square', 'fit', 'sameScale'])
  })

  test('the two show-all-regions rows carry their shared half in the label', () => {
    const { items } = build()
    expect(
      items.filter(
        i =>
          'label' in i &&
          typeof i.label === 'string' &&
          i.label.startsWith('Show all regions - '),
      ),
    ).toHaveLength(2)
  })

  test('squaring is one-shot, where the fit rule is state', () => {
    // squareView leaves nothing behind to mark: it averages the rows' current
    // scales and that is the end of it. The other two set which zoom-out limit
    // the rows are under, which outlives the click and so carries a mark.
    const { items } = build()
    expect(
      labelled(items, 'Square view - average bp per pixel'),
    ).not.toHaveProperty('type')
    for (const label of SHOW_ALL_REGIONS_LABELS) {
      expect(labelled(items, label)?.type).toBe('radio')
    }
  })

  test('the mark follows the fit rule in force', () => {
    for (const [state, expected] of [
      [{}, 'Show all regions - each row fit to width'],
      [{ sameScale: true }, 'Show all regions - same bp per pixel'],
    ] as const) {
      const { items } = build(state)
      expect(
        SHOW_ALL_REGIONS_LABELS.filter(l => labelled(items, l)?.checked),
      ).toEqual([expected])
    }
  })

  test('the anchor rows are only offered while following', () => {
    expect(labelled(build().follow, 'hg002mat')).toBeUndefined()
    expect(
      labelled(build({ followSynteny: true }).follow, 'hg002mat'),
    ).toBeDefined()
  })

  test('the anchor rows are named by assembly, with the current one marked', () => {
    // offered even for a plain two-row view: which haplotype drives and which
    // follows is the whole choice, and nothing about the pan reveals it
    const { follow } = build({ followSynteny: true, followAnchorIndex: 1 })
    expect(labelled(follow, 'hg002mat')?.checked).toBe(false)
    expect(labelled(follow, 'hg002pat')?.checked).toBe(true)
  })

  test('the checkbox shows the follow and flips it', () => {
    const label = 'Other rows track the anchor row through the alignment'
    const off = build()
    expect(labelled(off.follow, label)?.checked).toBe(false)
    labelled(off.follow, label)?.onClick?.()
    const on = build({ followSynteny: true })
    expect(labelled(on.follow, label)?.checked).toBe(true)
    labelled(on.follow, label)?.onClick?.()
    expect([...off.calls, ...on.calls]).toEqual([true, false])
  })

  test('picking an anchor row hands back its index, not its label', () => {
    const { follow, calls } = build({ followSynteny: true })
    labelled(follow, 'hg002pat')?.onClick?.()
    expect(calls).toEqual([1])
  })
})

// Switching which row drives is otherwise a radio in the Follow submenu, two
// levels away from the row being looked at.
describe('rowMenuItems', () => {
  function build(followSynteny: boolean, followAnchorIndex = 0) {
    const calls: unknown[] = []
    const items = rowMenuItems({
      views: [
        {
          assemblyNames: ['hg002mat'],
          menuItems: () => [{ label: 'Own', onClick: () => {} }],
        },
        {
          assemblyNames: ['hg002pat'],
          menuItems: () => [{ label: 'Own', onClick: () => {} }],
        },
      ],
      compactAllViews: () => {},
      expandAllViews: () => {},
      followSynteny,
      followAnchorIndex,
      setFollowAnchorIndex: idx => calls.push(idx),
    })
    return { items, calls }
  }

  function subMenu(items: MenuItem[], idx: number) {
    const item = items[idx]!
    return 'subMenu' in item ? resolveSubMenu(item) : []
  }

  test('off, each row is its own menu and nothing more', () => {
    const { items } = build(false)
    expect(items.map(i => ('label' in i ? i.label : ''))).toEqual([
      'hg002mat',
      'hg002pat',
    ])
    expect(items.every(i => !('icon' in i && i.icon))).toBe(true)
    expect(subMenu(items, 0).map(i => ('label' in i ? i.label : ''))).toEqual([
      'Own',
    ])
  })

  test('following, the anchor row wears the mark and every row offers the take', () => {
    const { items, calls } = build(true, 1)
    expect(items.map(i => 'icon' in i && !!i.icon)).toEqual([false, true])
    const take = subMenu(items, 0)[0]!
    expect(take).toMatchObject({
      type: 'radio',
      label: 'Anchor the follow on this row',
      checked: false,
    })
    expect(subMenu(items, 1)[0]).toMatchObject({ checked: true })
    if ('onClick' in take) {
      take.onClick()
    }
    expect(calls).toEqual([0])
  })
})

// The CIGAR control is gated on data, not config, so that a CIGAR-less PAF
// doesn't offer an inert row. The trap is that "the tier I'm holding has no CIGARs"
// and "this file has no CIGARs" look identical at the point of the gate.
describe('displayCanShowCigar', () => {
  test('a display that has not fetched yet is a maybe', () => {
    // optimistic, so the row is present from the first render rather than
    // popping in once data lands
    expect(displayCanShowCigar({ lodTier: 'fine' })).toBe(true)
    expect(displayCanShowCigar({ lodTier: 'coarse' })).toBe(true)
  })

  test('a loaded fine tier answers from its features', () => {
    expect(
      displayCanShowCigar({ lodTier: 'fine', featureData: { hasCigar: true } }),
    ).toBe(true)
    // a CIGAR-less PAF: nothing for the control to switch between
    expect(
      displayCanShowCigar({
        lodTier: 'fine',
        featureData: { hasCigar: false },
      }),
    ).toBe(false)
  })

  test('a loaded coarse tier stays a maybe despite reporting no CIGARs', () => {
    // The coarse PIF tier omits CIGARs by construction, so hasCigar is false
    // for a file that has them in its fine tier. Answering false here retracted
    // the CIGAR row on zoom-out and restored it on zoom-in — the LOD switch
    // made a setting appear and disappear under the user.
    expect(
      displayCanShowCigar({
        lodTier: 'coarse',
        featureData: { hasCigar: false },
      }),
    ).toBe(true)
  })
})
