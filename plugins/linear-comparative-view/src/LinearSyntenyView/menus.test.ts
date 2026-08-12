import { displayCanShowCigar, rowSyncMenuItems } from './menus.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The three row-sync modes are mutually exclusive in substance, not just in
// presentation — a pixel lock and a synteny follow place the same row twice per
// pan — so the menu is a radio group and the model has one setter for all three.
describe('rowSyncMenuItems', () => {
  function build(
    state: Partial<{
      linkViews: boolean
      followSynteny: boolean
      followAnchorIndex: number
    }> = {},
  ) {
    const calls: unknown[] = []
    const items = rowSyncMenuItems({
      views: [{ assemblyNames: ['hg002mat'] }, { assemblyNames: ['hg002pat'] }],
      linkViews: false,
      followSynteny: false,
      followAnchorIndex: 0,
      ...state,
      setRowSyncMode: mode => calls.push(mode),
      setFollowAnchorIndex: idx => calls.push(idx),
    })
    return { subMenu: (items[0] as { subMenu: MenuItem[] }).subMenu, calls }
  }

  function labelled(items: MenuItem[], label: string) {
    return items.find(i => 'label' in i && i.label === label) as
      | { checked?: boolean; onClick?: () => void; subMenu?: MenuItem[] }
      | undefined
  }

  test('exactly one mode is checked at a time', () => {
    const modes = [
      'Independent',
      'Link scroll and zoom',
      'Follow the matching region',
    ]
    for (const [state, expected] of [
      [{}, 'Independent'],
      [{ linkViews: true }, 'Link scroll and zoom'],
      [{ followSynteny: true }, 'Follow the matching region'],
    ] as const) {
      const { subMenu } = build(state)
      expect(modes.filter(m => labelled(subMenu, m)?.checked)).toEqual([
        expected,
      ])
    }
  })

  test('the anchor picker is only offered while following', () => {
    expect(labelled(build().subMenu, 'Anchor row')).toBeUndefined()
    expect(
      labelled(build({ followSynteny: true }).subMenu, 'Anchor row'),
    ).toBeDefined()
  })

  test('the anchor picker names the rows by assembly and marks the current one', () => {
    // offered even for a plain two-row view: which haplotype drives and which
    // follows is the whole choice, and nothing about the pan reveals it
    const rows = labelled(
      build({ followSynteny: true, followAnchorIndex: 1 }).subMenu,
      'Anchor row',
    )!.subMenu!
    expect(rows.map(r => ('label' in r ? r.label : undefined))).toEqual([
      'hg002mat',
      'hg002pat',
    ])
    expect(labelled(rows, 'hg002pat')?.checked).toBe(true)
  })

  test('picking a mode goes through the one setter that clears the other flag', () => {
    const { subMenu, calls } = build()
    labelled(subMenu, 'Follow the matching region')?.onClick?.()
    expect(calls).toEqual(['follow'])
  })
})

// The CIGAR menu is gated on data, not config, so that a CIGAR-less PAF doesn't
// offer an inert section. The trap is that "the tier I'm holding has no CIGARs"
// and "this file has no CIGARs" look identical at the point of the gate.
describe('displayCanShowCigar', () => {
  test('a display that has not fetched yet is a maybe', () => {
    // optimistic, so the menu is present from the first render rather than
    // popping in once data lands
    expect(displayCanShowCigar({ lodTier: 'fine' })).toBe(true)
    expect(displayCanShowCigar({ lodTier: 'coarse' })).toBe(true)
  })

  test('a loaded fine tier answers from its features', () => {
    expect(
      displayCanShowCigar({ lodTier: 'fine', featureData: { hasCigar: true } }),
    ).toBe(true)
    // a CIGAR-less PAF: nothing to put in the menu
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
    // the CIGAR menu on zoom-out and restored it on zoom-in — the LOD switch
    // made a menu appear and disappear under the user.
    expect(
      displayCanShowCigar({
        lodTier: 'coarse',
        featureData: { hasCigar: false },
      }),
    ).toBe(true)
  })
})
