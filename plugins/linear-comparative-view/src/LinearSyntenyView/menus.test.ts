import {
  cigarModeMenuItems,
  displayCanShowCigar,
  offscreenMateMenuItems,
  rowSyncMenuItems,
} from './menus.ts'

import type { CigarMode } from './cigarModes.ts'

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
      | {
          checked?: boolean
          subLabel?: string
          onClick?: () => void
          subMenu?: MenuItem[]
        }
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

  test('the two couplings say how they differ, since the labels do not', () => {
    // by pixels vs by the alignment is the whole distinction, and "Link scroll
    // and zoom" next to "Follow the matching region" does not carry it
    const { subMenu } = build()
    expect(labelled(subMenu, 'Link scroll and zoom')?.subLabel).toMatch(/pixel/)
    expect(labelled(subMenu, 'Follow the matching region')?.subLabel).toMatch(
      /align/,
    )
  })

  test('the anchor rows are only offered while following', () => {
    expect(labelled(build().subMenu, 'hg002mat')).toBeUndefined()
    expect(
      labelled(build({ followSynteny: true }).subMenu, 'hg002mat'),
    ).toBeDefined()
  })

  test('the anchor rows sit inline under a subheader, not in a nested submenu', () => {
    // which row drives is half of what there is to set here; a second level put
    // it three deep from the hamburger for no gain
    const { subMenu } = build({ followSynteny: true })
    expect(subMenu.some(i => i.type === 'subHeader')).toBe(true)
    expect(subMenu.some(i => 'subMenu' in i)).toBe(false)
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
    labelled(subMenu, 'Follow the matching region')?.onClick?.()
    expect(calls).toEqual(['follow'])
  })

  test('picking an anchor row hands back its index, not its label', () => {
    const { subMenu, calls } = build({ followSynteny: true })
    labelled(subMenu, 'hg002pat')?.onClick?.()
    expect(calls).toEqual([1])
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

// The item's label IS the finding, so it is the part with something to get
// wrong: a checkbox reading "Show unpaired alignments" tells a reader nothing,
// where a count and a contig number is the whole point of the feature.
describe('offscreenMateMenuItems', () => {
  function build(
    tally: { refName: string; count: number }[],
    showOffscreenMates = false,
  ) {
    const calls: boolean[] = []
    const items = offscreenMateMenuItems({
      offscreenMateTally: tally,
      showOffscreenMates,
      setShowOffscreenMates: arg => calls.push(arg),
    })
    return { items, calls }
  }

  test('the label reports the total and how many contigs it spans', () => {
    const { items } = build([
      { refName: 'ctgB', count: 2000 },
      { refName: 'ctgC', count: 767 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: '2,767 alignments map to 2 contigs not shown',
      type: 'checkbox',
      checked: false,
    })
  })

  test('one of each is not "1 alignments ... 1 contigs"', () => {
    const { items } = build([{ refName: 'ctgB', count: 1 }])
    expect(items[0]).toMatchObject({
      label: '1 alignment maps to 1 contig not shown',
    })
  })

  // Before a fetch lands the tally is empty, and the honest answer then is not
  // zero but unknown — so the item is absent rather than claiming nothing is
  // hidden. A two-contig comparison with everything drawn reads the same way.
  test('nothing hidden carries no item at all', () => {
    expect(build([]).items).toEqual([])
  })

  test('the item toggles the marks the label counts', () => {
    const { items, calls } = build([{ refName: 'ctgB', count: 3 }], true)
    expect(items[0]).toMatchObject({ checked: true })
    ;(items[0] as { onClick: () => void }).onClick()
    expect(calls).toEqual([false])
  })
})

// 'off' is not the low-detail end of one axis with the other two: it is the one
// mode that paints a gap the same as a match, and overlapping blocks with it run
// together. That is what the icon and the tooltip on that row are for, and both
// are easy to drop in a label edit.
interface CigarRow {
  label: string
  icon?: unknown
  helpText?: string
  checked?: boolean
  onClick?: () => void
}

describe('cigarModeMenuItems', () => {
  function rows(cigarMode: CigarMode = 'full') {
    const calls: CigarMode[] = []
    const items = cigarModeMenuItems({
      hasCigarData: true,
      cigarMode,
      setCigarMode: mode => calls.push(mode),
    })
    // same shape the `labelled` helper above reads, plus what this row carries
    return {
      calls,
      rows: (items[0] as { subMenu: CigarRow[] }).subMenu,
    }
  }

  test('the section is absent when the data carries no CIGARs', () => {
    expect(
      cigarModeMenuItems({
        hasCigarData: false,
        cigarMode: 'full',
        setCigarMode: () => {},
      }),
    ).toEqual([])
  })

  test('exactly one mode is checked at a time', () => {
    for (const mode of ['full', 'matches', 'off'] as const) {
      expect(rows(mode).rows.filter(r => r.checked).length).toBe(1)
    }
  })

  test('only the off row is marked as the one that can mislead', () => {
    const { rows: r, calls } = rows()
    const marked = r.filter(row => row.icon !== undefined)
    expect(marked.length).toBe(1)
    expect(marked[0]!.helpText).toMatch(/overlapping features/)
    // and the row it marks is the one that sets 'off'
    marked[0]!.onClick?.()
    expect(calls).toEqual(['off'])
  })

  test('the label says what the mode does, so it reads in a doc click path', () => {
    // website/src/lib/spec-recipe/fields.ts prints these labels verbatim, which
    // is why the warning is an icon and a tooltip rather than a ⚠ in the label
    for (const row of rows().rows) {
      expect(row.label).not.toMatch(/⚠/)
    }
  })
})
