import { displayCanShowCigar, navigationMenuItems } from './menus.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// One submenu for everything that decides where the rows are pointed and at
// what scale. The three sync modes are mutually exclusive in substance, not just
// in presentation — a pixel lock and a synteny follow place the same row twice
// per pan — so they are a radio group and the model has one setter for all three.
describe('navigationMenuItems', () => {
  function build(
    state: Partial<{
      linkViews: boolean
      followSynteny: boolean
      followAnchorIndex: number
    }> = {},
  ) {
    const calls: unknown[] = []
    const items = navigationMenuItems({
      views: [{ assemblyNames: ['hg002mat'] }, { assemblyNames: ['hg002pat'] }],
      linkViews: false,
      followSynteny: false,
      followAnchorIndex: 0,
      ...state,
      squareView: () => calls.push('square'),
      showAllRegions: () => calls.push('fit'),
      showAllRegionsSameScale: () => calls.push('sameScale'),
      setRowSyncMode: mode => calls.push(mode),
      setFollowAnchorIndex: idx => calls.push(idx),
    })
    return { subMenu: (items[0] as { subMenu: MenuItem[] }).subMenu, calls }
  }

  function labelled(items: MenuItem[], label: string) {
    return items.find(
      i => 'label' in i && i.label === label && i.type !== 'subHeader',
    ) as
      | {
          checked?: boolean
          subLabel?: string
          onClick?: () => void
          subMenu?: MenuItem[]
        }
      | undefined
  }

  test('one group, and nothing in it opens another popup', () => {
    // every section is a radio group or a pair of commands whose shared half of
    // the name is its subheader, and none is long enough to earn a third level
    const { subMenu } = build({ followSynteny: true })
    expect(subMenu.some(i => 'subMenu' in i)).toBe(false)
    expect(
      subMenu.flatMap(i =>
        i.type === 'subHeader' && 'label' in i ? [i.label] : [],
      ),
    ).toEqual(['Show all regions', 'Link views', 'Anchor row'])
  })

  test('the two zoom-outs sit under the name they share', () => {
    const { subMenu, calls } = build()
    expect(
      labelled(subMenu, 'Square view - average bp per pixel'),
    ).toBeDefined()
    labelled(subMenu, 'Square view - average bp per pixel')?.onClick?.()
    labelled(subMenu, 'Each row fit to width')?.onClick?.()
    labelled(subMenu, 'Same bp per pixel')?.onClick?.()
    expect(calls).toEqual(['square', 'fit', 'sameScale'])
  })

  test('the zoom commands are one-shot, not state', () => {
    const { subMenu } = build()
    for (const label of [
      'Square view - average bp per pixel',
      'Each row fit to width',
      'Same bp per pixel',
    ]) {
      expect(labelled(subMenu, label)).not.toHaveProperty('type')
    }
  })

  test('exactly one mode is checked at a time', () => {
    const modes = [
      'Independent',
      'Locked together - rows move together pixel-by-pixel',
      'Follow - auto-aligns views together based on visible features',
    ]
    for (const [state, expected] of [
      [{}, 'Independent'],
      [
        { linkViews: true },
        'Locked together - rows move together pixel-by-pixel',
      ],
      [
        { followSynteny: true },
        'Follow - auto-aligns views together based on visible features',
      ],
    ] as const) {
      const { subMenu } = build(state)
      expect(modes.filter(m => labelled(subMenu, m)?.checked)).toEqual([
        expected,
      ])
    }
  })

  test('the two couplings say how they differ in the label itself', () => {
    // by pixels vs by the alignment is the whole distinction, and two bare
    // names next to each other do not carry it
    const { subMenu } = build()
    const coupled = subMenu.flatMap(i =>
      'label' in i &&
      typeof i.label === 'string' &&
      i.label.includes(' - ') &&
      !i.label.startsWith('Square view')
        ? [i.label]
        : [],
    )
    expect(coupled).toHaveLength(2)
    expect(coupled.filter(l => l.includes('pixel'))).toHaveLength(1)
    expect(coupled.filter(l => l.includes('align'))).toHaveLength(1)
    expect(subMenu.every(i => !('subLabel' in i && i.subLabel))).toBe(true)
  })

  test('the anchor rows are only offered while following', () => {
    expect(labelled(build().subMenu, 'hg002mat')).toBeUndefined()
    expect(
      labelled(build({ followSynteny: true }).subMenu, 'hg002mat'),
    ).toBeDefined()
  })

  test('the anchor rows are named by assembly, with the current one marked', () => {
    // offered even for a plain two-row view: which haplotype drives and which
    // follows is the whole choice, and nothing about the pan reveals it
    const { subMenu } = build({ followSynteny: true, followAnchorIndex: 1 })
    expect(labelled(subMenu, 'hg002mat')?.checked).toBe(false)
    expect(labelled(subMenu, 'hg002pat')?.checked).toBe(true)
  })

  test('picking a mode goes through the one setter that clears the other flag', () => {
    const { subMenu, calls } = build()
    labelled(
      subMenu,
      'Follow - auto-aligns views together based on visible features',
    )?.onClick?.()
    expect(calls).toEqual(['follow'])
  })

  test('picking an anchor row hands back its index, not its label', () => {
    const { subMenu, calls } = build({ followSynteny: true })
    labelled(subMenu, 'hg002pat')?.onClick?.()
    expect(calls).toEqual([1])
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
