import { displayCanShowCigar, navigationMenuItems } from './menus.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The sync modes are mutually exclusive in substance, not just in presentation
// — a pixel lock and a synteny follow place the same row twice per pan — so they
// are a radio group and the model has one setter for all three.
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
    return { items, calls, linkViews: subMenuOf(items, 'Link views') }
  }

  function subMenuOf(items: MenuItem[], label: string) {
    const item = items.find(i => 'label' in i && i.label === label)
    return item && 'subMenu' in item ? item.subMenu : []
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

  test('the coupling is the one group, and the zoom commands are not in it', () => {
    const { items } = build({ followSynteny: true })
    expect(items.flatMap(i => ('subMenu' in i ? [i.label] : []))).toEqual([
      'Link views',
    ])
  })

  test('the anchor picker opens where the mode was picked, not a level deeper', () => {
    const { linkViews } = build({ followSynteny: true })
    expect(linkViews.some(i => 'subMenu' in i)).toBe(false)
    expect(
      linkViews.flatMap(i =>
        i.type === 'subHeader' && 'label' in i ? [i.label] : [],
      ),
    ).toEqual(['Anchor row'])
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

  test('the zoom commands are one-shot, not state', () => {
    const { items } = build()
    for (const label of [
      'Square view - average bp per pixel',
      'Show all regions - each row fit to width',
      'Show all regions - same bp per pixel',
    ]) {
      expect(labelled(items, label)).not.toHaveProperty('type')
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
      const { linkViews } = build(state)
      expect(modes.filter(m => labelled(linkViews, m)?.checked)).toEqual([
        expected,
      ])
    }
  })

  test('the two couplings say how they differ in the label itself', () => {
    // by pixels vs by the alignment is the whole distinction, and two bare
    // names next to each other do not carry it
    const { linkViews } = build()
    const coupled = linkViews.flatMap(i =>
      i.type === 'radio' &&
      typeof i.label === 'string' &&
      i.label.includes(' - ')
        ? [i.label]
        : [],
    )
    expect(coupled).toHaveLength(2)
    expect(coupled.filter(l => l.includes('pixel'))).toHaveLength(1)
    expect(coupled.filter(l => l.includes('align'))).toHaveLength(1)
    expect(linkViews.every(i => !('subLabel' in i && i.subLabel))).toBe(true)
  })

  test('the anchor rows are only offered while following', () => {
    expect(labelled(build().linkViews, 'hg002mat')).toBeUndefined()
    expect(
      labelled(build({ followSynteny: true }).linkViews, 'hg002mat'),
    ).toBeDefined()
  })

  test('the anchor rows are named by assembly, with the current one marked', () => {
    // offered even for a plain two-row view: which haplotype drives and which
    // follows is the whole choice, and nothing about the pan reveals it
    const { linkViews } = build({ followSynteny: true, followAnchorIndex: 1 })
    expect(labelled(linkViews, 'hg002mat')?.checked).toBe(false)
    expect(labelled(linkViews, 'hg002pat')?.checked).toBe(true)
  })

  test('picking a mode goes through the one setter that clears the other flag', () => {
    const { linkViews, calls } = build()
    labelled(
      linkViews,
      'Follow - auto-aligns views together based on visible features',
    )?.onClick?.()
    expect(calls).toEqual(['follow'])
  })

  test('picking an anchor row hands back its index, not its label', () => {
    const { linkViews, calls } = build({ followSynteny: true })
    labelled(linkViews, 'hg002pat')?.onClick?.()
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
