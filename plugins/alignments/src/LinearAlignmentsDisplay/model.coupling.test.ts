import { namesToBlock } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'
import { setConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { heightModeLabel } from '@jbrowse/display-kit/heightMode'
import { autorun } from 'mobx'

import {
  baseWorkerPileupData,
  makePileupDataResult,
} from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_PAIR_RL,
} from '../features/linkedReads/compute.ts'
import { colorFieldOf } from '../shared/alignmentsColor.ts'
import { CHAIN_FRAME_REV, CHAIN_SUPP_PRESENT } from '../shared/types.ts'
import { READ_COLOR_CATEGORY_BY_INDEX } from './colorUtils.ts'
import { applyReadColorsByGroup } from './groupLayout.ts'
import {
  bootAlignmentsDisplay,
  clickMenuItem,
  createTestAlignmentsDisplay,
  findMenuItem,
  hasMenuItem,
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
  menuSubItems,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { AlignmentsColorSetting } from '../shared/alignmentsColor.ts'
import type { ResolvedBlock } from '../shared/hitTestTypes.ts'
import type { BaseLayer, ReadColorBy } from '../shared/types.ts'

// The block a right-click resolves. Only refName is read by the menu items
// under test, but the hit carries a whole block or none at all, so the cases
// build a whole one.
function makeContextMenuBlock(): ResolvedBlock {
  return {
    refName: 'ctgA',
    rpcData: {} as ResolvedBlock['rpcData'],
    bpRange: [0, 100],
    blockStartPx: 0,
    blockWidth: 100,
    reversed: false,
  }
}

// The span a staged payload stands over. Most cases stage payloads on a view
// displaying nothing, so the span is spelled here; index 1 is a second contig.
function region(displayedRegionIndex: number) {
  return {
    refName: displayedRegionIndex === 0 ? 'ctgA' : 'ctgB',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  }
}

// Builds a real LinearAlignmentsDisplay so the cross-feature coupling that
// lives in the model actions (not the menu handlers) is tested against the
// actual model rather than a mock that would just reimplement it.
// `withRegions` gives the view a displayed region, which is the only thing that
// makes it name an assembly (`assemblyNames` derives from them) — needed by
// anything resolving a refName against it. Off by default: most cases here
// exercise menu/action coupling that never looks at a region.
function createDisplay({ withRegions = false } = {}) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const Session = baseSession.volatile(() => ({
    // `call` is replaced per test by the cases that drive an RPC.
    rpcManager: {
      call: jest.fn(() => Promise.resolve(makeEmptyAlignmentsResult())),
    },
    // `colorPalette` (and so `renderState`) derives from the session theme
    theme: createJBrowseTheme(),
    palette: resolvePalette(),
    // the feature-details lookup asks for the region's sequence adapter, and
    // reports a failed lookup through notify — hence no `sequence` here.
    // `getCanonicalRefName2` carries one alias because user-authored refName
    // text (the `sortedBy` slot) is normalized through it, and a stub that
    // only ever answered identity could not tell a reader that normalizes
    // from one that doesn't. It reads `.toLowerCase()` off its argument for the
    // same kind of reason: the real one does, so anything but a string throws
    // out of it, and a stub that tolerated one would be green over a malformed
    // slot taking the display down.
    assemblyManager: {
      get: (name: string) =>
        name === 'volvox'
          ? {
              initialized: true,
              getCanonicalRefName2: (refName: string) =>
                refName.toLowerCase() === 'chra' ? 'ctgA' : refName,
              configuration: { sequence: undefined },
            }
          : undefined,
    },
    notify: jest.fn(),
    notifyError: jest.fn(),
  }))
  const { view, display } = mount(Session)
  // `renderState` reads `view.width`, which throws while volatileWidth is unset
  view.setWidth(800)
  if (withRegions) {
    view.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 },
    ])
  }
  return display
}

describe('alignments display cross-feature coupling', () => {
  // The menu greys the toggle out while the band is off, so the action writes
  // its own slot and never turns coverage back on
  test('setShowSashimiArcs leaves coverage alone', () => {
    const display = createDisplay()
    display.setShowCoverage(false)

    display.setShowSashimiArcs(true)
    expect(display.showCoverage).toBe(false)
    expect(display.showSashimiArcs).toBe(false)

    display.setShowCoverage(true)
    expect(display.showSashimiArcs).toBe(true)
  })

  // Sashimi draws only over the coverage band, so with the band off the arcs are
  // off whatever the slot says, and turning the band back on restores the slot.
  test('sashimi resolves off while coverage is off, and returns with it', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    expect(display.showCoverage).toBe(true)

    display.setShowCoverage(false)
    expect(display.showSashimiArcs).toBe(false)

    display.setShowCoverage(true)
    expect(display.showSashimiArcs).toBe(true)
  })

  // Direction is a single shared field (readConnectionsDown); sashimi stores
  // no direction of its own, so there is nothing to keep in sync and
  // setReadConnectionsDown can't disturb sashimi visibility.
  test('setReadConnectionsDown does not affect sashimi visibility', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)

    display.setReadConnectionsDown(true)
    expect(display.showSashimiArcs).toBe(true)
    expect(display.readConnectionsDown).toBe(true)

    display.setShowSashimiArcs(false)
    display.setReadConnectionsDown(false)
    expect(display.showSashimiArcs).toBe(false)
    expect(display.readConnectionsDown).toBe(false)
  })
})

// Color by used to also manage a discovered-value map: clear it when
// the scheme changed, and — a second rule patching the first — NOT clear it
// when the radio already showing was re-picked, since that refetches nothing
// and an emptied map left the legend blank until the next pan. Both rules went
// with the map, the value's color being a pure function of the value
// (`colorTagUtils.test.ts` pins that, including the one thing that is not: the
// scheme picks which function runs). What has to survive is that re-picking the
// scheme in use is still inert.
describe('colorByField', () => {
  test('re-picking the scheme in use changes nothing', () => {
    const display = createDisplay()
    display.colorByField('mateRefName')
    const before = display.readColorContext

    display.colorByField('mateRefName')
    expect(display.readColorContext).toStrictEqual(before)
  })

  test('a different scheme reaches the bake', () => {
    const display = createDisplay()
    display.colorByField('tags.HP')
    const before = display.readColorContext

    display.colorByField('tags.RG')
    expect(display.readColorContext).not.toStrictEqual(before)
  })
})

describe('colorKeyTitle', () => {
  test("a preset field's title heads the key until one is written", () => {
    const display = createDisplay()
    display.applyPlot({ color: { field: 'mapq' } })
    expect(display.colorKeyTitle).toBe('Mapping quality')
    expect(display.colorScales.map(s => s.title)).toContain('Mapping quality')

    display.applyPlot({ color: { field: 'mapq', title: 'MAPQ' } })
    expect(display.colorKeyTitle).toBe('MAPQ')

    display.applyPlot({ color: { field: 'mapq', scale: 'linear' } })
    expect(display.colorKeyTitle).toBeUndefined()
  })
})

// The facet stacks the confident reads first, and the key lists its bins the
// same way unless the color turns it round.
describe('colorKeyDescending', () => {
  function binLabels(display: ReturnType<typeof createDisplay>) {
    return display
      .legendItems(display.colorPalette)
      .map(item => item.label)
      .filter(label => label.includes('MAPQ') || label.includes('tags.NM'))
  }

  test("mapq's key lists 30+ first until the color says otherwise", () => {
    const display = createDisplay()
    display.applyPlot({ color: { field: 'mapq' } })
    expect(binLabels(display)[0]).toBe('MAPQ 30+ (high confidence)')

    display.applyPlot({ color: { field: 'mapq', descending: false } })
    expect(binLabels(display)[0]).toBe('MAPQ 0 (multi-mapping)')
  })

  test('a threshold over a tag keys highest first where written', () => {
    const display = createDisplay()
    display.applyPlot({
      color: { field: 'tags.NM', scale: 'threshold', domain: ['1', '5'] },
    })
    expect(binLabels(display)).toEqual([
      'tags.NM < 1',
      'tags.NM 1 – 5',
      'tags.NM ≥ 5',
    ])

    display.applyPlot({
      color: {
        field: 'tags.NM',
        scale: 'threshold',
        domain: ['1', '5'],
        descending: true,
      },
    })
    expect(binLabels(display)[0]).toBe('tags.NM ≥ 5')
  })

  test('turning the key round re-bakes no read', () => {
    const display = createDisplay()
    display.applyPlot({ color: { field: 'mapq' } })
    const before = display.readColorContext
    setConf(display, ['color', 'descending'], false)
    expect(display.colorKeyDescending).toBe(false)
    expect(display.readColorContext).toBe(before)
  })
})

describe('keySectionOrder', () => {
  test('a facet on the color field hands the key its section order', () => {
    const display = createDisplay()
    display.colorByField('tags.HP')
    expect(display.keySectionOrder).toBeUndefined()

    display.setFacet({ field: 'tags.HP', domain: ['2'] })
    expect(['1', '2'].sort(display.keySectionOrder)).toEqual(['2', '1'])

    display.setFacet({ field: 'tags.RG', domain: [] })
    expect(display.keySectionOrder).toBeUndefined()
  })
})

// Toggling "view as pairs" auto-switches coloring for the common case but must
// not stomp on a color scheme the user picked deliberately (regression guard —
// the auto-switch previously overwrote colorBy unconditionally).
describe('setUnit color scheme preservation', () => {
  test('entering pairs nudges the plain default to insert-size-and-orientation', () => {
    const display = createDisplay()
    expect(display.colorBy.type).toBe('normal')

    display.setUnit('chain')
    expect(display.unit).toBe('chain')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')
  })

  test('entering pairs leaves the plain fill under a per-base layer', () => {
    const display = createDisplay()
    display.setBaseLayer({ type: 'modifications' })

    display.setUnit('chain')
    expect(display.colorBy.type).toBe('normal')
    expect(display.bodyColorScheme).toBe('modifications')
  })

  test('entering pairs preserves an explicit non-pairing color scheme', () => {
    const display = createDisplay()
    display.colorByField('tags.HP')

    display.setUnit('chain')
    expect(display.colorBy.type).toBe('tag')
    expect(display.colorBy.tag).toBe('HP')
  })

  test('leaving pairs swaps the SV-signal fill back to normal', () => {
    const display = createDisplay()
    display.setUnit('chain')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')

    display.setUnit('read')
    expect(display.unit).toBe('read')
    expect(display.colorBy.type).toBe('normal')
  })

  // A first-of-pair strand fill is the usual stranded RNA-seq pileup, picked
  // with pairs off; a trip through pairs used to reset it to normal
  test('a trip through pairs keeps any other paired-end fill', () => {
    const display = createDisplay()
    display.colorByField('firstOfPairStrand')

    display.setUnit('chain')
    display.setUnit('read')
    expect(display.colorBy.type).toBe('firstOfPairStrand')
  })

  test('leaving pairs preserves an explicit non-pairing color scheme', () => {
    const display = createDisplay()
    display.setUnit('chain')
    display.colorByField('tags.HP')

    display.setUnit('read')
    expect(display.unit).toBe('read')
    expect(display.colorBy.type).toBe('tag')
    expect(display.colorBy.tag).toBe('HP')
  })
})

// The "Arc color" entry under "Color by..." is omitted (not greyed-out) when no
// read-connection overlay is active — the caller passes `arcColor: undefined` so
// arcColorSection drops it, matching every other conditional section in the
// menu. Guards against reintroducing the always-shown disabled stub.

describe('Arc color menu visibility', () => {
  test('hidden when no read-connection overlay is active', () => {
    const display = createDisplay()
    display.setReadConnections('off')
    expect(hasMenuItem(display.trackMenuItems(), 'Arc color')).toBe(false)
  })

  test('shown for read arcs', () => {
    const display = createDisplay()
    display.setReadConnections('arc')
    expect(hasMenuItem(display.trackMenuItems(), 'Arc color')).toBe(true)
  })

  test('shown for read cloud', () => {
    const display = createDisplay()
    display.setReadConnections('cloud')
    expect(hasMenuItem(display.trackMenuItems(), 'Arc color')).toBe(true)
  })
})

describe('arc color follows the reads unless it names its own field', () => {
  test('an empty arcColor takes a pair field from the reads', () => {
    const display = createDisplay()
    display.setArcColorField('')
    display.colorByField('pairOrientation')
    expect(display.arcColorField).toBe('pairOrientation')
    display.colorByField('strand')
    expect(display.arcColorField).toBe('insertSizeAndOrientation')
  })

  test('a display naming no arcColor follows the reads', () => {
    const display = createDisplay()
    display.colorByField('insertSize')
    expect(display.arcColorField).toBe('insertSize')
  })

  test('an arcColor field of its own ignores the reads', () => {
    const display = createDisplay()
    display.setArcColorField('insertSize')
    display.colorByField('pairOrientation')
    expect(display.arcColorField).toBe('insertSize')
  })

  test('the Arc color radios write the field, Same as reads the empty one', () => {
    const display = createDisplay()
    display.setReadConnections('arc')
    display.colorByField('insertSize')
    const arcMenu = () => menuSubItems(display.trackMenuItems(), 'Arc color')
    clickMenuItem(arcMenu(), 'Pair orientation')
    expect(display.arcColorField).toBe('pairOrientation')
    expect(findMenuItem(arcMenu(), 'Same as reads')).toMatchObject({
      checked: false,
    })
    clickMenuItem(arcMenu(), 'Same as reads')
    expect(display.arcColorField).toBe('insertSize')
    expect(findMenuItem(arcMenu(), 'Same as reads')).toMatchObject({
      checked: true,
    })
  })
})

// Sort and the read SIZE rows act only on the pileup rows, so they grey out
// (with a tip) when the pileup band is hidden — mirrors the disabled
// band-options pattern. Group-by and filters are NOT gated: both still affect
// the coverage band when the pileup is off.
describe('pileup-only menus grey out when the pileup is hidden', () => {
  test('Sort by... is enabled with the pileup shown, disabled when hidden', () => {
    const display = createDisplay()
    display.setShowPileup(true)
    expect(
      findMenuItem(display.trackMenuItems(), 'Sort by...')?.disabled,
    ).toBeFalsy()

    display.setShowPileup(false)
    const item = findMenuItem(display.trackMenuItems(), 'Sort by...')
    expect(item?.disabled).toBe(true)
    expect(item?.disabledHelpText).toBeTruthy()
  })

  // The size presets and the row cap need rows to act on; the "Track sizing"
  // modes do not — grow sizes the TRACK, and with the pileup off it collapses
  // the track to its coverage band, which is exactly when you want it. So the
  // gate is per row, and "Read height" itself stays open to reach them.
  //
  // Scoped to that submenu rather than searched from the root: 'Normal' is also
  // a Color by... scheme, and the root-first search would answer with that one.
  function readHeightRow(
    display: ReturnType<typeof createDisplay>,
    label: string,
  ) {
    return findMenuItem(
      menuSubItems(display.trackMenuItems(), 'Read height'),
      label,
    )
  }

  test.each(['Normal', 'Compact', 'Custom...', 'Set max layout height...'])(
    'Read height row %s greys out with the pileup hidden',
    label => {
      const display = createDisplay()
      display.setShowPileup(true)
      expect(readHeightRow(display, label)?.disabled).toBeFalsy()

      display.setShowPileup(false)
      const item = readHeightRow(display, label)
      expect(item?.disabled).toBe(true)
      expect(item?.disabledHelpText).toBeTruthy()
    },
  )

  test.each([
    // from the shared builder, so this can't drift from the rendered wording
    heightModeLabel('fixed', 'read'),
    heightModeLabel('grow', 'read'),
    heightModeLabel('fit', 'read'),
  ])('Track sizing row %s stays live with the pileup hidden', label => {
    const display = createDisplay()
    display.setShowPileup(false)
    const item = readHeightRow(display, label)
    expect(item).toBeDefined()
    expect(item?.disabled).toBeFalsy()
  })

  test('Read height itself stays open so those rows are reachable', () => {
    const display = createDisplay()
    display.setShowPileup(false)
    expect(
      findMenuItem(display.trackMenuItems(), 'Read height')?.disabled,
    ).toBeFalsy()
  })

  test.each(['Group by...', 'Filter by...'])(
    '%s stays enabled with the pileup hidden (still affects coverage)',
    label => {
      const display = createDisplay()
      display.setShowPileup(false)
      expect(
        findMenuItem(display.trackMenuItems(), label)?.disabled,
      ).toBeFalsy()
    },
  )
})

// "Show..." is the longest submenu in the track menu, so it is kept to one kind
// of row: a long list is hard to scan when the rows aren't alike, not when there
// are many. The row cap was the one action among the checkboxes, and it is
// sizing, so it closes "Read height" — beside the read size and the
// fixed/grow/fit modes — instead.
describe('the row cap sits with the other sizing controls', () => {
  test('"Read height" offers it and "Show..." does not', () => {
    const display = createDisplay()
    const items = display.trackMenuItems()
    const show = menuSubItems(items, 'Show...')
    const height = menuSubItems(items, 'Read height')
    expect(hasMenuItem(height, 'Set max layout height...')).toBe(true)
    expect(hasMenuItem(show, 'Set max layout height...')).toBe(false)
  })

  test('"Show..." is checkboxes end to end', () => {
    const display = createDisplay()
    const show = menuSubItems(display.trackMenuItems(), 'Show...')
    expect(show.length).toBeGreaterThan(0)
    expect(show.map(i => i.type)).toEqual(show.map(() => 'checkbox'))
  })
})

// `sortLayout` gates the sort on `sortedBy.refName` matching the loaded
// regions' own refName, which is canonical. The center-line menu writes a
// canonical one (it reads the view's region), but this is a config slot, so a
// config or session spec writes whatever the author typed. Unnormalized, an
// aliased spec leaves the reads unsorted with the menu still showing the sort
// as active — no error, and assembly-dependent, so it works on one config and
// not the next.
describe('sortedBy refName normalization', () => {
  // The assembly is resolved off the VIEW, which names one only once it has
  // regions — so a display whose view is still empty reads the slot back raw.
  // That is the same window in which nothing has been laid out to sort.
  test('an aliased refName resolves to the canonical one', () => {
    const display = createDisplay({ withRegions: true })
    // 'chrA' is the test assembly's alias for the canonical 'ctgA'
    display.setSortedByAtPosition({
      type: 'base',
      pos: 100,
      refName: 'chrA',
    })

    expect(display.sortedBy?.refName).toBe('ctgA')
    // everything else on the slot rides through untouched
    expect(display.sortedBy?.pos).toBe(100)
    expect(display.sortedBy?.type).toBe('base')
  })

  // The slot is `frozen`, so a config or session spec can write half a sort. A
  // column is a refName AND a position, so either half missing is no sort — and
  // the refName half has to be answered here, because normalizing it instead
  // threw a TypeError out of a getter the fetch autorun and the render both
  // read, replacing the whole track with an error over a typo in a spec.
  test.each([
    ['refName', { type: 'base', pos: 100 }],
    ['pos', { type: 'base', refName: 'ctgA' }],
  ])('a slot naming no %s is no sort, not a throw', (_half, slot) => {
    const display = createDisplay({ withRegions: true })
    // Cast because this is the one writer the action's signature can't
    // describe: `sortedBy` is a frozen slot, so a config or session spec can
    // put half a sort in it, and that is exactly the input under test.
    display.setSortedByAtPosition(
      slot as Parameters<typeof display.setSortedByAtPosition>[0],
    )

    expect(display.sortedBy).toBeUndefined()
  })

  test('a canonical refName is left alone, and no sort stays undefined', () => {
    const display = createDisplay({ withRegions: true })
    expect(display.sortedBy).toBeUndefined()

    display.setSortedByAtPosition({
      type: 'base',
      pos: 100,
      refName: 'ctgA',
    })
    expect(display.sortedBy?.refName).toBe('ctgA')
  })
})

// Chain layout is handed neither `sortedBy` nor `layoutOrder` — its rows
// are chains — so every ordering control has to curate itself out the way
// `canCollapseGroupRows` already does, or a sort is a silent no-op (and a tag
// sort refetches the region for values nothing reads).
describe('ordering controls in chain mode', () => {
  test('"Sort by..." greys out, naming chain mode as the reason', () => {
    const display = createDisplay()
    display.setUnit('read')
    expect(display.canSortReads).toBe(true)

    display.setUnit('chain')
    expect(display.canSortReads).toBe(false)
    const item = findMenuItem(display.trackMenuItems(), 'Sort by...')
    expect(item?.disabled).toBe(true)
    expect(item?.disabledHelpText).toMatch(/View as pairs/)
  })

  test('the context menu drops its position-anchored sorts too', () => {
    const display = createDisplay()
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      hit: { block: makeContextMenuBlock(), genomicPos: 50 },
      featureId: 'read1',
    })
    expect(hasMenuItem(display.contextMenuItems(), 'Sort by')).toBe(true)

    display.setUnit('chain')
    expect(hasMenuItem(display.contextMenuItems(), 'Sort by')).toBe(false)
    // the rest of the menu is untouched — only the ordering rows go
    expect(
      hasMenuItem(display.contextMenuItems(), 'Open feature details'),
    ).toBe(true)
  })

  // `rpcProps()` is the fetch cache key (through `settingsFetchInputs`), so
  // anything in it that nothing then reads buys a refetch for nothing. Chain
  // layout reads neither soft clipping nor the sort tag.
  test('the sort tag leaves the fetch key when chain mode drops it', () => {
    const display = createDisplay()
    display.setSortedByAtPosition({
      type: 'tag',
      pos: 50,
      refName: 'ctgA',
      tag: 'HP',
    })
    expect(display.rpcProps().sortTag).toBe('HP')

    display.setUnit('chain')
    expect(display.rpcProps().sortTag).toBeUndefined()
  })

  // Chain mode degrades a per-read grouping to none (`facetForUnit`), so it
  // has to leave the key too. The menu won't offer one in chain mode, but a
  // session or the settings editor can hold one — and then clearing or
  // changing it dropped every fetched region to re-read byte-identical data.
  test('a per-read grouping leaves the fetch key when chain mode drops it', () => {
    const display = createDisplay()
    display.setFacet({ field: 'strand' })
    expect(display.rpcProps().facet).toEqual({ field: 'strand' })

    display.setUnit('chain')
    expect(display.rpcProps().facet).toBeUndefined()

    // a chain-groupable dimension still reaches the worker, keeping chains whole
    display.setFacet({ field: 'tags.HP' })
    expect(display.rpcProps().facet).toEqual({
      field: 'tags.HP',
      unit: 'chain',
    })
  })

  // The collapse is the same shape of no-op, and the one you can arrive at with
  // the slot already on: tick it under a chain-consistent grouping, then switch
  // to linked reads. The menu row goes with `canCollapseGroupRows`, so from
  // there it can't be unticked — and `collapseGroupRows` has to answer "is the
  // collapse IN EFFECT", since the layout lays chains out as true stacks
  // whatever the slot says and the label chip words its height button off this.
  test('the collapse stops being in effect when chain mode starts', () => {
    const display = createDisplay()
    display.setFacet({ field: 'tags.HP' })
    display.setCollapseGroupRows(true)
    expect(display.collapseGroupRows).toBe(true)
    expect(display.canCollapseGroupRows).toBe(true)
    expect(
      hasMenuItem(display.trackMenuItems(), 'Collapse groups to one row'),
    ).toBe(true)

    display.setUnit('chain')
    // the grouping survives — `tag` is chain-consistent — so this is the
    // collapse alone stepping aside, not the whole grouping degrading
    expect(display.prefersOffset).toBe(true)
    expect(display.canCollapseGroupRows).toBe(false)
    expect(display.collapseGroupRows).toBe(false)
    expect(
      hasMenuItem(display.trackMenuItems(), 'Collapse groups to one row'),
    ).toBe(false)
  })

  test('toggling soft clipping in chain mode leaves the fetch key alone', () => {
    const display = createDisplay()
    display.setUnit('chain')
    const before = JSON.stringify(display.rpcProps())

    display.setShowSoftClipping(true)
    expect(display.showSoftClipping).toBe(true)
    expect(display.rpcProps().showSoftClipping).toBe(false)
    expect(JSON.stringify(display.rpcProps())).toBe(before)

    // ...and it is a real fetch input again the moment the mode is left
    display.setUnit('read')
    expect(display.rpcProps().showSoftClipping).toBe(true)
  })
})

// The worker knows no chains: chain identity is joined on the main thread, so
// the mode toggle is a relayout of data already in hand.
describe('chain mode is a main-thread tier', () => {
  const first = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
  const second = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR

  // Two overlapping mates of one fragment: stacked in pileup, one row as a chain.
  function matesDisplay() {
    const display = createDisplay()
    display.setRpcData(
      0,
      {
        groups: [
          {
            key: '',
            label: '',
            data: {
              ...baseWorkerPileupData(2),
              ...namesToBlock(['frag', 'frag']),
              readPositions: new Uint32Array([100, 200, 150, 250]),
              readFlags: new Uint16Array([first, second]),
              readStrands: new Int8Array([1, -1]),
              segmentPositions: new Uint32Array([100, 200, 150, 250]),
              segmentReadIndices: new Uint32Array([0, 1]),
            },
          },
        ],
      },
      region(0),
    )
    return display
  }

  const laidOut = (display: ReturnType<typeof matesDisplay>) =>
    display.laidOutByGroup.get('')!.get(0)!
  const rows = (display: ReturnType<typeof matesDisplay>) => [
    ...laidOut(display).readYs,
  ]

  test('toggling pairs ungrouped refetches nothing and lays chains out at once', () => {
    const display = matesDisplay()
    const fetchKey = JSON.stringify(display.rpcProps())
    expect(rows(display)).toEqual([0, 1])
    expect(display.rawDataByGroup.get('')!.get(0)!).not.toHaveProperty(
      'readChainIndices',
    )

    display.setUnit('chain')
    expect(JSON.stringify(display.rpcProps())).toBe(fetchKey)
    expect(display.rpcDataMap.size).toBe(1)
    expect(rows(display)).toEqual([0, 0])
    expect([...laidOut(display).connectingLinePositions]).toEqual([100, 250])
    expect(display.readIdsByChainName.get('frag')).toEqual(['id0', 'id1'])

    display.setUnit('read')
    expect(rows(display)).toEqual([0, 1])
    expect(display.readIdsByChainName.size).toBe(0)
  })

  test('the toggle leaves the chain-free tier alone', () => {
    const display = matesDisplay()
    const raw = display.rawDataByGroup
    display.setUnit('chain')
    expect(display.rawDataByGroup).toBe(raw)
  })

  test('a facet in effect sends the chain as the unit it keeps whole', () => {
    const display = matesDisplay()
    display.setFacet({ field: 'tags.HP' })
    const fetchKey = JSON.stringify(display.rpcProps())

    display.setUnit('chain')
    expect(JSON.stringify(display.rpcProps())).not.toBe(fetchKey)
    expect(display.rpcProps().facet).toEqual({
      field: 'tags.HP',
      unit: 'chain',
    })
  })
})

// Chain layout puts a chain's alignments on one row across displayed regions,
// but its connecting-line pass is per region and can't join them — so the SVG
// overlay has to, whether or not the user asked for curved connectors. It stays
// scoped to the pairs that straddle a boundary; the per-region line owns the
// rest, and drawing both would double every within-region connector.
describe('cross-region chain connectors', () => {
  test('chain mode claims the overlay for straddling pairs alone', () => {
    const display = createDisplay()
    expect(display.bezierArcScope).toBe('none')

    display.setUnit('chain')
    expect(display.bezierArcScope).toBe('crossRegion')
  })

  test('ticking curved connectors widens it back to every connection', () => {
    const display = createDisplay()
    display.setShowBezierConnections(true)
    expect(display.bezierArcScope).toBe('all')

    // and chain mode doesn't narrow an explicit choice
    display.setUnit('chain')
    expect(display.bezierArcScope).toBe('all')
  })
})

// In pileup layout a normal pair's connector is the straight-line pass's and a
// discordant pair's is the overlay's curve.
describe('curved connectors', () => {
  const first = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
  const second = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR

  function connectorDisplay() {
    const display = createDisplay({ withRegions: true })
    display.setShowBezierConnections(true)
    display.setRpcData(
      0,
      {
        groups: [
          {
            key: '',
            label: '',
            data: {
              ...baseWorkerPileupData(4),
              ...namesToBlock(['normal', 'normal', 'outward', 'outward']),
              readPositions: new Uint32Array([
                100, 200, 400, 500, 1000, 1100, 1400, 1500,
              ]),
              readFlags: new Uint16Array([first, second, first, second]),
              readStrands: new Int8Array([1, -1, -1, 1]),
              readPairOrientations: new Uint8Array([
                LINKED_READ_COLOR_PAIR_LR,
                LINKED_READ_COLOR_PAIR_LR,
                LINKED_READ_COLOR_PAIR_RL,
                LINKED_READ_COLOR_PAIR_RL,
              ]),
            },
          },
        ],
      },
      region(0),
    )
    return display
  }

  test('one walk answers both passes, and a band resize or a recolor reuses it', () => {
    const display = connectorDisplay()
    const dispose = autorun(() => display.bezierPairSections)
    const connectors = display.connectorsByGroup
    expect(connectors.get('')?.overlayPairs).toHaveLength(1)
    expect(connectors.get('')?.lines.get(0)?.numLinkedReadLines).toBe(1)

    display.setCoverageHeight(display.coverageHeight + 20)
    display.colorByField('strand')
    expect(display.connectorsByGroup).toBe(connectors)
    dispose()
  })

  test('a curved-connector toggle keeps the layout and the colors', () => {
    const display = connectorDisplay()
    const dispose = autorun(() => display.laidOutByGroup)
    const layout = display.laidOutByGroupFramed
    const colored = display.laidOutByGroupColored
    expect(display.laidOutByGroup.get('')?.get(0)?.numLinkedReadLines).toBe(1)

    display.setShowBezierConnections(false)
    expect(display.laidOutByGroupFramed).toBe(layout)
    expect(display.laidOutByGroupColored).toBe(colored)
    expect(display.laidOutByGroup.get('')?.get(0)?.numLinkedReadLines).toBe(0)
    dispose()
  })

  test('a lane collapsed to its coverage draws no straight lines and keys none', () => {
    const display = connectorDisplay()
    display.setShowLegend(true)
    display.toggleGroupCollapsed('')
    expect(display.connectorsByGroup.get('')?.lines.size).toBe(0)
    expect([...display.connectionColorTypes]).toEqual([
      LINKED_READ_COLOR_PAIR_RL,
    ])
  })

  test("the key names the straight lines' color as well as the curves'", () => {
    const display = connectorDisplay()
    display.setShowLegend(true)
    expect([...display.connectionColorTypes].sort()).toEqual([
      LINKED_READ_COLOR_PAIR_LR,
      LINKED_READ_COLOR_PAIR_RL,
    ])
  })
})

// The read categories drop reads in the worker, so they are filters and live
// under "Filter by..." — not "Show...", which is now layers only, and not "Read
// connections". Their old home is the regression this pins.
describe('read categories + filter submenu', () => {
  test('the categories are under "Filter by...", not "Show..."', () => {
    const display = createDisplay()
    const items = display.trackMenuItems()
    const filters = menuSubItems(items, 'Filter by...')
    for (const noun of [
      'Proper pairs',
      'Reads without a mate',
      'Split alignments',
      'Spliced reads',
    ]) {
      expect(hasMenuItem(filters, noun)).toBe(true)
    }

    const show = menuSubItems(items, 'Show...')
    expect(hasMenuItem(show, 'Show proper pairs')).toBe(false)
    expect(hasMenuItem(show, 'Show only split alignments')).toBe(false)
  })

  test('a category radio writes filterBy', () => {
    const display = createDisplay()
    // Scoped to the category row rather than the group above it: the group's
    // label carries the active count, so it is renamed by the very click being
    // made here. `menuSubItems` recurses, so naming the row is enough.
    clickMenuItem(
      menuSubItems(display.trackMenuItems(), 'Proper pairs'),
      'Hide proper pairs',
    )
    expect(display.readFilter.properPairs).toBe('exclude')

    // and back to the absent state, not a stored 'all'
    clickMenuItem(
      menuSubItems(display.trackMenuItems(), 'Proper pairs — hidden'),
      'All reads',
    )
    expect(display.readFilter.properPairs).toBeUndefined()
  })

  // The category row says what it is doing without being opened, and the group
  // above it counts — so a filtered track reads as filtered at the top level.
  test('an active category shows on its own row and in the count', () => {
    const display = createDisplay()
    display.setReadFilter({ ...display.readFilter, properPairs: 'exclude' })
    const filters = menuSubItems(display.trackMenuItems(), 'Filter by... (1)')
    expect(hasMenuItem(filters, 'Proper pairs — hidden')).toBe(true)
  })

  // The label is the only place the track chrome admits a filter is hiding
  // reads, and a category not counted there was the bug: three of these used to
  // hide reads while it read "Filter by..." with no number at all.
  test('the count includes the read categories', () => {
    const display = createDisplay()
    expect(findMenuItem(display.trackMenuItems(), 'Filter by...')).toBeDefined()

    display.setReadFilter({
      ...display.readFilter,
      readName: 'readA',
      tagFilters: [{ tag: 'HP', value: '1' }],
      properPairs: 'exclude',
      split: 'only',
    })
    expect(
      findMenuItem(display.trackMenuItems(), 'Filter by... (4)'),
    ).toBeDefined()
  })
})

// openContextMenu sets coord + block + hit kinds as one unit and resets the
// read feature. These invariants are what let the menu builder read a block
// without its hit going missing, and stop a repositioned menu from showing the
// previous read — behavior otherwise guarded only by a comment.
describe('openContextMenu atomic state and stale-read reset', () => {
  test('sets the anchor and the whole hit together', () => {
    const display = createDisplay()
    display.openContextMenu({
      clientX: 10,
      clientY: 20,
      hit: {
        block: makeContextMenuBlock(),
        genomicPos: 42,
        cigarHit: { type: 'mismatch', index: 0, position: 42, length: 1 },
      },
    })
    expect(display.contextMenuInfo).toMatchObject({ clientX: 10, clientY: 20 })
    expect(display.contextMenuHit?.genomicPos).toBe(42)
    expect(display.contextMenuHit?.cigarHit).toEqual({
      type: 'mismatch',
      index: 0,
      position: 42,
      length: 1,
    })
  })

  // A consecutive right-click repositions the still-open menu without a clear,
  // so opening over a new hit must drop the previous read's feature items.
  test('reopening over a new hit resets the previous read feature', () => {
    const display = createDisplay()
    display.setContextMenuFeature(
      new SimpleFeature({
        uniqueId: 'read1',
        refName: 'ctgA',
        start: 0,
        end: 100,
      }),
    )
    expect(display.contextMenuFeature).toBeDefined()

    display.openContextMenu({
      clientX: 1,
      clientY: 2,
      hit: {
        block: makeContextMenuBlock(),
        genomicPos: 5,
        indicatorHit: {
          type: 'indicator',
          position: 5,
          indicatorType: 'insertion',
        },
      },
    })
    expect(display.contextMenuFeature).toBeUndefined()
    expect(display.contextMenuHit?.indicatorHit).toEqual({
      type: 'indicator',
      position: 5,
      indicatorType: 'insertion',
    })
  })

  // The id is what the menu's feature items are built from, so it has to be
  // there the instant the menu opens — the feature it names is a fetch behind,
  // and gating the items on that is what left a right-click showing an empty
  // menu.
  test('the read id lands synchronously, unlike the feature', () => {
    const display = createDisplay()
    display.openContextMenu({
      clientX: 1,
      clientY: 2,
      featureId: 'read1',
    })
    expect(display.contextMenuFeatureId).toBe('read1')
    expect(display.contextMenuFeature).toBeUndefined()
  })

  test('closeContextMenu wipes all context-menu state', () => {
    const display = createDisplay()
    display.openContextMenu({
      clientX: 3,
      clientY: 4,
      hit: {
        block: makeContextMenuBlock(),
        genomicPos: 9,
        cigarHit: { type: 'mismatch', index: 1, position: 9, length: 1 },
      },
      featureId: 'read1',
    })
    display.closeContextMenu()
    expect(display.contextMenuInfo).toBeUndefined()
    expect(display.contextMenuHit).toBeUndefined()
    expect(display.contextMenuFeature).toBeUndefined()
    expect(display.contextMenuFeatureId).toBeUndefined()
  })

  // The pin the menu takes on the hovered read has to come off with the menu.
  // Nothing else drops it: the canvas mouseleave holds it while the menu is up,
  // and after a click that opened a drawer widget the cursor may never return
  // to the pileup to clear it on a move.
  test('closing releases the hover box pinned to the menu target', () => {
    const display = createDisplay()
    display.openContextMenu({
      clientX: 3,
      clientY: 4,
      featureId: 'read1',
    })
    expect(display.featureIdUnderMouse).toBe('read1')

    display.closeContextMenu()
    expect(display.featureIdUnderMouse).toBeUndefined()
  })
})

// What the display asks the adapter for when a menu item needs the whole
// feature behind an id.
describe('the feature-details lookup', () => {
  // One read, id 'read1', spanning 1000-5000 of a loaded ctgA region.
  function seedOneRead(
    display: ReturnType<typeof createDisplay>,
    overrides: Partial<WorkerPileupData> = {},
  ) {
    display.setRpcData(
      0,
      {
        groups: [
          {
            key: '',
            label: '',
            data: {
              ...makeEmptyPileupData(),
              readKeys: ['read1'],
              ...namesToBlock(['readA']),
              readPositions: new Uint32Array([1000, 5000]),
              readFlags: new Uint16Array([0]),
              readMapqs: new Uint8Array([60]),
              ...overrides,
            },
          },
        ],
      },
      {
        refName: 'ctgA',
        start: 0,
        end: 10000,
        assemblyName: 'volvox',
      },
    )
  }

  function rpcCall(display: ReturnType<typeof createDisplay>) {
    const call = jest.fn().mockResolvedValue({ feature: undefined })
    getSession(display).rpcManager.call = call
    return call
  }

  // A single base at the feature's start, not its extent. The adapter returns
  // everything overlapping the region and only the matching id is kept, so the
  // extent only ever made the query bigger — a read's length for a BAM, but the
  // whole block for a synteny alignment, where it re-read a megabase PAF block
  // just to name it.
  //
  // This is only sound because feature ids don't depend on the queried region:
  // every adapter behind this display numbers features from file offsets
  // (BamSlightlyLazyFeature, CramSlightlyLazyFeature, the PAF/PIF row readers).
  // An adapter that numbered per query would break the lookup silently, and
  // this assertion is the only place that says so.
  test('asks for one base at the feature start, not its whole extent', async () => {
    const display = createDisplay()
    seedOneRead(display)
    const call = rpcCall(display)

    await display.selectFeatureById('read1')

    expect(call).toHaveBeenCalledWith(
      expect.any(String),
      'GetPileupFeatureDetails',
      expect.objectContaining({
        featureId: 'read1',
        regions: [
          {
            refName: 'ctgA',
            assemblyName: 'volvox',
            start: 1000,
            end: 1001,
          },
        ],
      }),
    )
  })

  // refName and assembly come from the region the read was fetched from, not
  // from a scan over the view's regions — that scan could pick another region's
  // assembly, and threw on the one it couldn't resolve.
  test('an id with no loaded data makes no request at all', async () => {
    const display = createDisplay()
    const call = rpcCall(display)

    await display.selectFeatureById('read1')

    expect(call).not.toHaveBeenCalled()
  })

  // `getFeatureInfoById` reports the worker's own normalized strand, not a
  // second derivation from SAM_FLAG_REVERSE. The two agree for BAM/CRAM, but a
  // PAF/synteny block (LGVSyntenyDisplay pushes those through this same model)
  // carries a real `strand` and no flags at all — so the flag read named every
  // reverse-strand block `(+)` in the hover tooltip and in `hoveredFeature`.
  test.each([
    ['a BAM read (strand and SAM_FLAG_REVERSE agree)', 16, -1],
    ['a synteny block (real strand, no flags)', 0, -1],
    ['a forward read', 0, 1],
  ])('reports the feature strand for %s', (_label, flags, strand) => {
    const display = createDisplay()
    seedOneRead(display, {
      readFlags: new Uint16Array([flags]),
      readStrands: new Int8Array([strand]),
    })

    expect(display.getFeatureInfoById('read1')?.strand).toBe(strand)
  })

  // Offering menu items from the id means a lookup can now come back empty
  // under a click. Saying nothing would make the item look broken.
  test('a lookup that finds nothing says so', async () => {
    const display = createDisplay()
    seedOneRead(display)
    rpcCall(display)

    await display.selectFeatureById('read1')

    expect(getSession(display).notify).toHaveBeenCalledWith(
      expect.stringContaining('Could not load details'),
      'warning',
    )
  })
})

// The strip below coverage is reserved for sashimi arcs that 'auto' pushed down,
// and 'auto' only pushes an arc down to resolve a crossing. So filtering out the
// junctions that did the crossing has to hand that space back to the pileup —
// driven here through the real model (config slot -> getter -> band geometry)
// rather than the pure `belowCoverageBandsGeometry`, so the wiring is covered too.
describe('sashimi score filter releases the reserved band', () => {
  // Two interleaving junctions, the second supported by only 2 reads.
  function seedCrossingJunctions(display: ReturnType<typeof createDisplay>) {
    display.setRpcData(
      0,
      {
        groups: [
          {
            key: '',
            label: '',
            data: {
              ...makeEmptyPileupData(),
              sashimiX1: new Uint32Array([100, 300]),
              sashimiX2: new Uint32Array([500, 700]),
              sashimiFwd: new Uint32Array([0, 0]),
              sashimiRev: new Uint32Array([0, 0]),
              sashimiDonors: new Uint8Array([0, 0]),
              sashimiAcceptors: new Uint8Array([0, 0]),
              sashimiCounts: new Uint32Array([20, 2]),
            },
          },
        ],
      },
      region(0),
    )
  }

  test('auto: filtering out the crossing junction gives the strip back to the pileup', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    display.setSashimiArcsMode('auto')
    display.setMinSashimiScore(0)
    seedCrossingJunctions(display)

    expect(display.belowCoverageBands.hasSashimiBand).toBe(true)
    expect(display.coverageDisplayHeight).toBe(
      display.coverageHeight + display.sashimiArcsHeight,
    )

    // drops the 2-read junction => nothing left to cross => nothing goes down
    display.setMinSashimiScore(5)
    expect(display.belowCoverageBands.hasSashimiBand).toBe(false)
    expect(display.coverageDisplayHeight).toBe(display.coverageHeight)
  })

  test('down: the strip stays reserved for any surviving junction', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    display.setSashimiArcsMode('down')
    display.setMinSashimiScore(5)
    seedCrossingJunctions(display)

    // the 20-read junction survives and still draws below coverage
    expect(display.belowCoverageBands.hasSashimiBand).toBe(true)

    display.setMinSashimiScore(50)
    expect(display.belowCoverageBands.hasSashimiBand).toBe(false)
  })

  test('up: arcs overlay coverage, so the strip is never reserved', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    display.setSashimiArcsMode('up')
    display.setMinSashimiScore(0)
    seedCrossingJunctions(display)

    expect(display.belowCoverageBands.hasSashimiBand).toBe(false)
    expect(display.coverageDisplayHeight).toBe(display.coverageHeight)
  })

  // The reserved strip and the arcs drawn into it come off one set of junction
  // keys (`sashimiDownKeysByGroup`), so the lane naming the strip has to name
  // WHICH junction claimed it — the overlay places each arc by looking itself up
  // in that same set.
  test('auto: the lane names the junction the overlay will draw below', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    display.setSashimiArcsMode('auto')
    display.setMinSashimiScore(0)
    seedCrossingJunctions(display)

    expect([...display.sashimiDownArcLanes]).toEqual([''])
    // heaviest-first: the 20-read junction claims 'up', the 2-read one drops
    expect([...display.sashimiDownKeysByGroup.get('')!]).toEqual([
      'ctgA:300:700',
    ])
  })

  // Junctions on different chromosomes occupy disjoint screen ranges, so they
  // cannot visually collide and 'auto' has nothing to resolve. Pooling them onto
  // one bp number line read them as interleaving and reserved a strip below
  // every lane's coverage that no arc was ever bound for.
  test('auto: two chromosomes in view do not cross each other', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    display.setSashimiArcsMode('auto')
    display.setMinSashimiScore(0)
    const junction = (start: number, end: number): WorkerPileupData => ({
      ...makeEmptyPileupData(),
      sashimiX1: new Uint32Array([start]),
      sashimiX2: new Uint32Array([end]),
      sashimiFwd: new Uint32Array([0]),
      sashimiRev: new Uint32Array([0]),
      sashimiDonors: new Uint8Array([0]),
      sashimiAcceptors: new Uint8Array([0]),
      sashimiCounts: new Uint32Array([20]),
    })
    // interleaving as bare numbers (10k < 30k < 50k < 70k), but one per chrom
    display.setRpcData(
      0,
      {
        groups: [{ key: '', label: '', data: junction(10_000, 50_000) }],
      },
      {
        refName: 'ctgA',
        start: 0,
        end: 100_000,
        assemblyName: 'volvox',
      },
    )
    display.setRpcData(
      1,
      {
        groups: [{ key: '', label: '', data: junction(30_000, 70_000) }],
      },
      {
        refName: 'ctgB',
        start: 0,
        end: 100_000,
        assemblyName: 'volvox',
      },
    )

    expect(display.belowCoverageBands.hasSashimiBand).toBe(false)

    // the same two spans on ONE chromosome do interleave and claim the strip
    display.setRpcData(
      1,
      { groups: [{ key: '', label: '', data: junction(30_000, 70_000) }] },
      { refName: 'ctgA', start: 0, end: 100_000, assemblyName: 'volvox' },
    )
    expect(display.belowCoverageBands.hasSashimiBand).toBe(true)
  })
})

// `renderState.sections` is built from `sections`, which reads `lanes` — and a
// lane is `groupOrder` plus the maps, all derived from `rpcDataMap`. So the
// render autorun observes a data arrival through the render state itself, with
// no help from the `rpcDataMap.size === 0` first-paint gate in the render
// callback. Deleting
// that gate would therefore NOT stop this display double-drawing on arrival.
// Band geometry has to follow the
// laid-out data, so this coupling is structural, not incidental — anything
// claiming to retire that entry has to keep this test green while decoupling
// the two autoruns' ordering.
test('a region arrival invalidates renderState, not just the size gate', () => {
  const display = createDisplay()
  let runs = 0
  const dispose = autorun(() => {
    void display.renderState
    runs++
  })
  expect(runs).toBe(1)

  display.setRpcData(
    0,
    {
      groups: [{ key: '', label: '', data: makeEmptyPileupData() }],
    },
    region(0),
  )
  expect(runs).toBe(2)

  dispose()
})

// The upload autorun reads `sourceSections`, and `sync` packs ~9 GPU passes per
// region from what it finds there. Which tier a setting lands in therefore
// decides whether flipping it repacks every buffer on the track. Two tiers are
// load-bearing for that and neither is visible from the renderer, so they are
// pinned here:
//
//  - band geometry must not reach the laid-out payloads at all (a resize drag
//    fires the upload autorun on every pointer move),
//  - a recolor must reach them WITHOUT re-running layout, and must leave
//    `readYs` — the token `GpuAlignmentsRenderer` keys its upload memo on —
//    reference-identical.
describe('upload tiers: what a settings change does to the laid-out payloads', () => {
  function displayWithOneRead(
    color: Partial<AlignmentsColorSetting> = { field: 'tags.HP' },
  ) {
    const display = createDisplay()
    // Tag coloring is the CPU-baked scheme `colorTagMap` feeds; set it before
    // seeding, since colorBy is an rpcProps (tier-1) setting and clears data.
    display.applyPlot({ color })
    display.setRpcData(
      0,
      {
        groups: [
          {
            key: '',
            label: '',
            data: {
              ...makeEmptyPileupData(),
              readKeys: ['r1'],
              ...namesToBlock(['r1']),
              readPositions: new Uint32Array([100, 200]),
              readFlags: new Uint16Array(1),
              readMapqs: new Uint8Array(1),
              readInsertSizes: new Float32Array(1),
              readPairOrientations: new Uint8Array(1),
              readStrands: new Int8Array([1]),
              readInterchrom: new Uint8Array(1),
              readTagValues: ['1'],
              segmentPositions: new Uint32Array([100, 200]),
              segmentReadIndices: new Uint32Array([0]),
              segmentEdgeFlags: new Uint8Array([3]),
              numSegments: 1,
            },
          },
        ],
      },
      region(0),
    )
    expect(display.rpcDataMap.size).toBe(1)
    return display
  }

  const region0 = (display: ReturnType<typeof displayWithOneRead>) =>
    display.sourceSections[0]!.laidOutPileupMap.get(0)!

  test('a band resize leaves every laid-out payload identical', () => {
    const display = displayWithOneRead()
    const before = region0(display)

    display.setCoverageHeight(display.coverageHeight + 25)

    // The upload autorun re-fires (sourceSections is a fresh array), but the
    // payload it would pack is the same object, so the renderer skips it.
    expect(region0(display)).toBe(before)
  })

  test('a recolor rebakes the colors without re-running layout', () => {
    const display = displayWithOneRead()
    const beforeLayout = display.laidOutByGroupUncolored
    const before = region0(display)

    display.applyPlot({ color: { field: 'tags.HP', range: ['#ff0000'] } })

    const after = region0(display)
    // Layout memoized across the recolor…
    expect(display.laidOutByGroupUncolored).toBe(beforeLayout)
    // …so the payload is a fresh object over the SAME layout arrays, which is
    // what lets the renderer rewrite the read pass alone.
    expect(after).not.toBe(before)
    expect(after.readYs).toBe(before.readYs)
    expect(after.mismatchYs).toBe(before.mismatchYs)
    expect(after.readTagColors).not.toBe(before.readTagColors)
    expect(after.readTagColors[0]).toBe(0xff0000ff)
  })

  test('a color write that leaves a pinned insert-size band alone keeps the layout', () => {
    const pinned = { field: 'insertSize', domain: ['150', '600'] }
    const display = displayWithOneRead(pinned)
    const beforeLayout = display.laidOutByGroupUncolored
    const before = region0(display)

    display.applyPlot({ color: { ...pinned, value: 'red' } })

    expect(display.laidOutByGroupUncolored).toBe(beforeLayout)
    expect(region0(display).readYs).toBe(before.readYs)
  })

  test('a declared range is a recolor and not a refetch', () => {
    const display = displayWithOneRead()
    const before = display.rpcProps()

    display.applyPlot({ color: { field: 'tags.HP', range: ['#ff0000'] } })

    expect(display.rpcProps()).toStrictEqual(before)
  })

  test('a fit-mode drag frame that changes no row count keeps the layout', () => {
    const display = displayWithOneRead()
    display.setHeightMode('fit')
    const beforeLayout = display.laidOutByGroupUncolored
    const pitch = display.rowHeight

    // The fit autorun rewrites the pitch by a fraction of a px per drag frame.
    display.setFittedHeightPx(display.fittedHeightPx + 0.25)

    expect(display.rowHeight).not.toBe(pitch)
    expect(display.laidOutByGroupUncolored).toBe(beforeLayout)
  })

  test('a relayout replaces the layout arrays', () => {
    const display = displayWithOneRead()
    const before = region0(display)

    // Read height is a genuine layout input — it sets how many rows fit.
    display.setFeatureHeight(display.configuredFeatureHeight + 3)

    expect(region0(display).readYs).not.toBe(before.readYs)
  })
})

// What the display knows about which base modifications exist, driven through
// the real model rather than the pure legend builders — those take a set and
// cannot see whether anything hands them the right one.
//
// The property under test is that this is REGION-SCOPED. It used to be a
// volatile map `setRpcData` added to and nothing ever cleared, so it grew for
// the life of the tab: every case below would have passed on the accumulating
// form too, except the ones asserting a type is GONE.
describe('modification detection follows the loaded regions', () => {
  const withMods = (...types: string[]) => ({
    groups: [
      {
        key: '',
        label: '',
        data: { ...makeEmptyPileupData(), detectedModifications: types },
      },
    ],
  })

  test('nothing is detected, and nothing claims to be ready, before a fetch', () => {
    const display = createDisplay()
    expect(display.detectedModificationTypes).toEqual([])
    expect(display.modificationsReady).toBe(false)
  })

  test('a landed fetch is what makes the answer ready', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m'), region(0))
    expect(display.modificationsReady).toBe(true)
    expect(display.detectedModificationTypes).toEqual(['m'])
    // the color the legend and the marks both resolve from the type code
    expect(display.detectedModifications.get('m')).toBe('rgb(255,0,0)')
  })

  // The reason for the change: pan off the locus carrying 6mA and the menu
  // must stop offering it.
  test('a type the new region does not carry is dropped', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m', 'a'), region(0))
    expect(display.detectedModificationTypes).toEqual(['m', 'a'])
    display.setRpcData(0, withMods('m'), region(0))
    expect(display.detectedModificationTypes).toEqual(['m'])
  })

  test('every loaded region contributes, deduped', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m'), region(0))
    display.setRpcData(1, withMods('m', 'h'), region(1))
    expect(display.detectedModificationTypes).toEqual(['m', 'h'])
    // refetching one region takes only what that region alone carried
    display.setRpcData(1, withMods(), region(1))
    expect(display.detectedModificationTypes).toEqual(['m'])
  })

  // `modificationsReady` used to be set true by the fetch and never set back,
  // so it outlived its data: after a clear it still claimed an answer for reads
  // that were no longer loaded, and the menu skipped "Loading modifications..."
  // while the replacing fetch was in flight.
  test('clearing the data un-readies the answer', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m'), region(0))
    display.clearAllRpcData()
    expect(display.modificationsReady).toBe(false)
    expect(display.detectedModificationTypes).toEqual([])
  })

  // Every group of every loaded region, including one a subclass hides
  // (`hiddenGroupKeys` is empty on this display and only LGVSyntenyDisplay
  // fills it, so there is no setter here to drive). That is deliberate: the
  // menu is what asks, and a type belonging to a hidden lane is still one the
  // user can reveal. The legend asks `presentModifications` instead, which is
  // off the laid-out map and so hidden-filtered.
  test('groups are unioned within a region', () => {
    const display = createDisplay()
    display.setRpcData(
      0,
      {
        groups: [
          {
            key: 'g1',
            label: 'g1',
            data: { ...makeEmptyPileupData(), detectedModifications: ['m'] },
          },
          {
            key: 'g2',
            label: 'g2',
            data: { ...makeEmptyPileupData(), detectedModifications: ['a'] },
          },
        ],
      },
      region(0),
    )
    expect(display.detectedModificationTypes).toEqual(['m', 'a'])
  })
})

// A collapse and a height override are keyed by group key, and a group key only
// names a lane within the grouping that issued it. `''` is the worst of them:
// the ungrouped lane's key AND the catch-all bucket of tag / pairOrientation /
// mateAssembly grouping. Carried across a grouping change it collapsed the whole
// ungrouped pileup, and an ungrouped lane draws no chip, so nothing on screen
// could expand it again.
describe('per-lane state belongs to one grouping key space', () => {
  // One read spanning the region, in each named group. Enough for a lane with a
  // row in it, which is what a collapse zeroes.
  function seedGroups(
    display: ReturnType<typeof createDisplay>,
    groups: { key: string; label: string }[],
  ) {
    display.setRpcData(
      0,
      {
        groups: groups.map(({ key, label }) => ({
          key,
          label,
          data: {
            ...makeEmptyPileupData(),
            readKeys: [`read-${key}`],
            ...namesToBlock([`read-${key}`]),
            readPositions: new Uint32Array([1000, 5000]),
            readFlags: new Uint16Array([0]),
            readMapqs: new Uint8Array([60]),
          },
        })),
      },
      {
        refName: 'ctgA',
        start: 0,
        end: 10000,
        assemblyName: 'volvox',
      },
    )
  }

  // Grouped by HP with the untagged reads collapsed — the state every case below
  // then carries into a different grouping.
  function collapsedUntaggedLane() {
    const display = createDisplay({ withRegions: true })
    display.setFacet({ field: 'tags.HP' })
    seedGroups(display, [
      { key: '1', label: 'HP: 1' },
      { key: '', label: 'HP: none' },
    ])
    display.toggleGroupCollapsed('')
    expect(display.collapsedGroups.has('')).toBe(true)
    return display
  }

  // The route the setter-only clear missed: the settings editor writes the
  // `facet` object directly, and Reset track settings drops the config delta
  // holding it. Neither calls an action of this display.
  test('a slot write that ungroups drops the collapse it would land on', () => {
    const display = collapsedUntaggedLane()
    display.configuration.setSubschema('facet', {})
    seedGroups(display, [{ key: '', label: '' }])
    expect(display.facet).toBeUndefined()
    expect(display.collapsedGroups.has('')).toBe(false)
    expect(display.lanes.map((l: { maxY: number }) => l.maxY)).toEqual([1])
    // And why that had no way back: the chevron that undoes a collapse hangs
    // off a group label, which the ungrouped lane does not draw.
    expect(display.showsGroupLabels).toBe(false)
  })

  // The height overrides are the same key space and go the same way, rather
  // than needing a rule of their own.
  test('a height override goes with the collapse', () => {
    const display = collapsedUntaggedLane()
    display.toggleGroupExpanded('')
    expect(display.groupHeightOverrides.has('')).toBe(true)
    display.configuration.setSubschema('facet', {})
    expect(display.groupHeightOverrides.has('')).toBe(false)
  })

  // A live figure keys on this, since the collapses and height overrides are
  // in no snapshot: the hidden sections, config now, sit beside them.
  // A chain cannot group by a per-read dimension, its reads disagreeing, so
  // the stack degrades to the one ungrouped section; the facet's hidden keys
  // name MAPQ's sections and wait unread rather than hide it.
  test("a chain leaves the facet's hidden sections unread, and a re-pick keeps them", () => {
    const display = createDisplay({ withRegions: true })
    display.setFacet({ field: 'mapq' })
    display.hideGroup('0')
    expect([...display.hiddenGroupKeys]).toEqual(['0'])
    display.setUnit('chain')
    expect(display.groupKeySpace).toBe('')
    expect(display.hiddenGroupKeys.size).toBe(0)
    display.setUnit('read')
    display.setFacet({ field: 'mapq' })
    expect([...display.hiddenGroupKeys]).toEqual(['0'])
  })

  test('groupStateKey carries every per-group state the lanes draw from', () => {
    const display = collapsedUntaggedLane()
    display.toggleGroupExpanded('')
    display.hideGroup('1')
    const [hidden, [collapsed, heights]] = display.groupStateKey as [
      string[],
      [string[], Record<string, number>],
    ]
    expect(hidden).toEqual(['1'])
    expect(collapsed).toEqual([''])
    expect(Object.keys(heights)).toEqual([''])
  })

  // Grouping FROM ungrouped is the same collision the other way round: the
  // whole-pileup collapse would arrive on the "HP: none" lane.
  test('grouping drops a collapse of the ungrouped pileup', () => {
    const display = createDisplay({ withRegions: true })
    seedGroups(display, [{ key: '', label: '' }])
    display.toggleGroupCollapsed('')
    display.setFacet({ field: 'tags.HP' })
    expect(display.collapsedGroups.has('')).toBe(false)
  })

  test('re-picking the grouping keeps its domain, and a reorder keeps the lane state', () => {
    const display = createDisplay({ withRegions: true })
    display.setFacet({ field: 'tags.HP', domain: ['2'] })
    seedGroups(display, [
      { key: '1', label: 'HP: 1' },
      { key: '2', label: 'HP: 2' },
    ])
    display.toggleGroupCollapsed('1')
    display.setFacet({ field: 'tags.HP' })
    expect(display.facet).toEqual({ field: 'tags.HP', domain: ['2'] })
    expect(display.groupOrder.map(g => g.key)).toEqual(['2', '1'])
    display.setFacet({ field: 'tags.HP', domain: ['1'] })
    expect(display.groupOrder.map(g => g.key)).toEqual(['1', '2'])
    expect(display.collapsedGroups.has('1')).toBe(true)
    display.setFacet({ field: 'tags.RG' })
    expect(display.facet).toEqual({ field: 'tags.RG', domain: [] })
  })

  test('the Sections menu moves a lane and writes the drawn order as the domain', () => {
    const display = createDisplay({ withRegions: true })
    expect(hasMenuItem(display.trackMenuItems(), 'Sections')).toBe(false)
    display.setFacet({ field: 'tags.HP' })
    seedGroups(display, [
      { key: '1', label: 'HP: 1' },
      { key: '2', label: 'HP: 2' },
    ])
    const rows = () => menuSubItems(display.trackMenuItems(), 'Sections')
    expect(rows().map(r => ('label' in r ? r.label : undefined))).toEqual([
      'HP: 1',
      'HP: 2',
      'Reset section order',
    ])
    const moveDown = menuSubItems(rows(), 'HP: 1')[1] as { onClick: () => void }
    const fetched = display.rpcProps()
    moveDown.onClick()
    expect(display.facet).toEqual({ field: 'tags.HP', domain: ['2', '1'] })
    expect(display.rpcProps()).toEqual(fetched)
    expect(display.groupOrder.map(g => g.key)).toEqual(['2', '1'])
    ;(rows()[2] as { onClick: () => void }).onClick()
    expect(display.facet).toEqual({ field: 'tags.HP', domain: [] })
  })

  // Chain mode degrades a per-read dimension to ungrouped (`facetForUnit`)
  // with the slot untouched, so the fetch comes back as one '' lane while the
  // menu still reads "Group by MAPQ".
  test('entering chain mode drops the state of a grouping it degrades', () => {
    const display = createDisplay({ withRegions: true })
    display.setFacet({ field: 'mapq' })
    seedGroups(display, [{ key: '0', label: 'MAPQ 30+ (high confidence)' }])
    display.toggleGroupCollapsed('0')
    display.setUnit('chain')
    expect(display.effectiveFacet).toBeUndefined()
    expect(display.collapsedGroups.has('0')).toBe(false)
  })

  // Switching between two groupings that both hand out digit keys — mapq's
  // confidence buckets and pairOrientation's categories — moves a collapse onto
  // an unrelated lane. Recoverable (both lanes draw a chip) and still wrong.
  test('two digit-keyed dimensions do not inherit one another state', () => {
    const display = createDisplay({ withRegions: true })
    display.setFacet({ field: 'mapq' })
    seedGroups(display, [{ key: '0', label: 'MAPQ 30+ (high confidence)' }])
    display.toggleGroupCollapsed('0')
    display.setFacet({ field: 'pairOrientation' })
    expect(display.collapsedGroups.has('0')).toBe(false)
  })

  // Re-picking the grouping already in effect changes no key, so nothing is
  // dropped: the reaction fires on the key SPACE moving, not on the write.
  test('re-setting the same grouping keeps the state', () => {
    const display = collapsedUntaggedLane()
    display.setFacet({ field: 'tags.HP' })
    expect(display.collapsedGroups.has('')).toBe(true)
  })
})

// The selection used to ride `renderState` so the renderers could frame it,
// which repainted every band on a click and put the box in the SVG export. It
// is the chrome's guide now, like the hover: a click recomputes `selectionInk`
// and nothing the canvas reads.
describe('a selection is the chrome guide, not the canvas', () => {
  test('selecting a read leaves renderState alone', () => {
    const { session, display } = createTestAlignmentsDisplay()
    let renderStates = 0
    const stop = autorun(() => {
      void display.renderState
      renderStates++
    })
    expect(renderStates).toBe(1)
    session.setSelection(
      new SimpleFeature({ uniqueId: 'r1', refName: 'ctgA', start: 5, end: 9 }),
    )
    expect(display.selectedFeatureId).toBe('r1')
    expect(renderStates).toBe(1)
    expect('selectedFeatureId' in display.renderState).toBe(false)
    expect('selectedChainReadIds' in display.renderState).toBe(false)
    // Nothing fetched yet, so no read has ink to light.
    expect(display.selectionInk).toEqual([])
    stop()
  })
})

// A reverse segment under a reverse frame bakes `fwdStrand` only when the
// framing runs, so it reads the bake's answer off the display's own context.
describe('chain-strand framing: the gate, the bake and the key agree', () => {
  const fills: ReadColorBy[] = [
    { type: 'normal' },
    { type: 'strand' },
    { type: 'insertSize' },
    { type: 'pairOrientation' },
    { type: 'tag', tag: 'HP' },
  ]
  const layers: (BaseLayer | undefined)[] = [
    undefined,
    { type: 'perBaseQuality' },
    { type: 'perBaseLetter' },
    { type: 'modifications' },
  ]
  const splitSegment = makePileupDataResult({
    readStrands: Int8Array.of(-1),
    readChainHasSupp: Uint8Array.of(CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV),
  })

  test.each(
    fills.flatMap(fill =>
      layers.map(layer => [fill.type, layer?.type, fill, layer] as const),
    ),
  )('%s fill under the %s layer', (_fill, _layer, fill, layer) => {
    const display = createDisplay()
    display.setUnit('chain')
    display.colorByField(colorFieldOf(fill))
    display.setBaseLayer(layer)
    const baked = applyReadColorsByGroup(
      new Map([['', new Map([[0, splitSegment]])]]),
      display.readColorContext,
    )
    const category =
      READ_COLOR_CATEGORY_BY_INDEX[
        baked.get('')!.get(0)!.readColorCategories[0]!
      ]
    expect(category === 'fwdStrand').toBe(display.framesChainStrand)
    expect(display.framesChainStrand).toBe(fill.type === 'pairOrientation')
  })
})
