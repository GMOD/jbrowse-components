import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { heightModeLabel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import { namesToBlock } from '../shared/readNameBlock.ts'
import {
  bootAlignmentsDisplay,
  clickMenuItem,
  findMenuItem,
  hasMenuItem,
  isMenuItemClickable,
  makeEmptyPileupData,
  menuSubItems,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { ResolvedBlock } from '../shared/hitTestTypes.ts'

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
    rpcManager: { call: jest.fn() },
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
  // Sashimi only draws over the coverage band, so enabling it must enable
  // coverage or the toggle silently does nothing.
  test('setShowSashimiArcs turns on coverage when enabled', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(false)
    display.setShowCoverage(false)

    display.setShowSashimiArcs(true)
    expect(display.showSashimiArcs).toBe(true)
    expect(display.showCoverage).toBe(true)

    display.setShowSashimiArcs(false)
    expect(display.showSashimiArcs).toBe(false)
  })

  // The other direction of the same invariant. Hiding coverage used to leave
  // "Show sashimi arcs" ticked over a display drawing none — and the worker
  // skips the junction scan when the band is off, so there was no data behind
  // the ticked box either.
  test('setShowCoverage(false) turns sashimi off', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)
    expect(display.showCoverage).toBe(true)

    display.setShowCoverage(false)
    expect(display.showSashimiArcs).toBe(false)

    // and turning coverage back on does not resurrect it — sashimi is opt-in
    display.setShowCoverage(true)
    expect(display.showSashimiArcs).toBe(false)
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

// `setColorScheme` used to also manage a discovered-value map: clear it when
// the scheme changed, and — a second rule patching the first — NOT clear it
// when the radio already showing was re-picked, since that refetches nothing
// and an emptied map left the legend blank until the next pan. Both rules went
// with the map, the value's colour being a pure function of the value
// (`colorTagUtils.test.ts` pins that, including the one thing that is not: the
// scheme picks which function runs). What has to survive is that re-picking the
// scheme in use is still inert.
describe('setColorScheme', () => {
  test('re-picking the scheme in use changes nothing', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'mateRefName' })
    const before = display.readColorContext

    display.setColorScheme({ type: 'mateRefName' })
    expect(display.readColorContext).toStrictEqual(before)
  })

  test('a different scheme reaches the bake', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'tag', tag: 'HP' })
    const before = display.readColorContext

    display.setColorScheme({ type: 'tag', tag: 'RG' })
    expect(display.readColorContext).not.toStrictEqual(before)
  })
})

// Toggling "view as pairs" auto-switches coloring for the common case but must
// not stomp on a color scheme the user picked deliberately (regression guard —
// the auto-switch previously overwrote colorBy unconditionally).
describe('setLinkedReads color scheme preservation', () => {
  test('entering pairs nudges the plain default to insert-size-and-orientation', () => {
    const display = createDisplay()
    expect(display.colorBy.type).toBe('normal')

    display.setLinkedReads('normal')
    expect(display.linkedReads).toBe('normal')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')
  })

  test('entering pairs preserves an explicit non-pairing color scheme', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'tag', tag: 'HP' })

    display.setLinkedReads('normal')
    expect(display.colorBy.type).toBe('tag')
    expect(display.colorBy.tag).toBe('HP')
  })

  test('leaving pairs reverts a pairing-specific scheme to normal', () => {
    const display = createDisplay()
    display.setLinkedReads('normal')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')

    display.setLinkedReads('off')
    expect(display.linkedReads).toBe('off')
    expect(display.colorBy.type).toBe('normal')
  })

  test('leaving pairs preserves an explicit non-pairing color scheme', () => {
    const display = createDisplay()
    display.setLinkedReads('normal')
    display.setColorScheme({ type: 'tag', tag: 'HP' })

    display.setLinkedReads('off')
    expect(display.linkedReads).toBe('off')
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
    display.setSortSlot({
      type: 'base',
      pos: 100,
      refName: 'chrA',
      assemblyName: 'volvox',
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
    display.setSortSlot({ ...slot, assemblyName: 'volvox' } as Parameters<
      typeof display.setSortSlot
    >[0])

    expect(display.sortedBy).toBeUndefined()
  })

  test('a canonical refName is left alone, and no sort stays undefined', () => {
    const display = createDisplay({ withRegions: true })
    expect(display.sortedBy).toBeUndefined()

    display.setSortSlot({
      type: 'base',
      pos: 100,
      refName: 'ctgA',
      assemblyName: 'volvox',
    })
    expect(display.sortedBy?.refName).toBe('ctgA')
  })
})

// Chain layout is handed neither `sortedBy` nor `largeFeaturesFirst` — its rows
// are chains — so every ordering control has to curate itself out the way
// `canCollapseGroupRows` already does, or a sort is a silent no-op (and a tag
// sort refetches the region for values nothing reads).
describe('ordering controls in chain mode', () => {
  test('"Sort by..." greys out, naming chain mode as the reason', () => {
    const display = createDisplay()
    display.setLinkedReads('off')
    expect(display.canSortReads).toBe(true)

    display.setLinkedReads('normal')
    expect(display.canSortReads).toBe(false)
    const item = findMenuItem(display.trackMenuItems(), 'Sort by...')
    expect(item?.disabled).toBe(true)
    expect(item?.disabledHelpText).toMatch(/View as pairs/)
  })

  // The mirror case: `flipStrandLongReadChains` / `colorSupplementaryChains`
  // are read only inside readColorCategory's isChain branches, so OUTSIDE chain
  // mode they are the silent no-op — two checkboxes, one ticked by default,
  // that change nothing.
  //
  // colorBy.test.tsx covers the menu builder given an `isChainMode`; this covers
  // the half that bug actually lived in, which is whether the model hands it the
  // right one. Driven through the real display, so it asserts nothing about how
  // the flag is spelled.
  test('"Supplementary / split reads" greys out until chain mode is on', () => {
    const display = createDisplay()
    display.setLinkedReads('off')
    const off = findMenuItem(
      display.trackMenuItems(),
      'Supplementary / split reads',
    )
    expect(off?.disabled).toBe(true)
    expect(off?.disabledHelpText).toMatch(/View as pairs/)

    display.setLinkedReads('normal')
    expect(
      findMenuItem(display.trackMenuItems(), 'Supplementary / split reads')
        ?.disabled,
    ).toBe(false)
  })

  test('the context menu drops its position-anchored sorts too', () => {
    const display = createDisplay()
    display.openContextMenu({
      anchor: { clientX: 0, clientY: 0 },
      hit: { block: makeContextMenuBlock(), genomicPos: 50 },
      featureId: 'read1',
    })
    expect(hasMenuItem(display.contextMenuItems(), 'Sort by')).toBe(true)

    display.setLinkedReads('normal')
    expect(hasMenuItem(display.contextMenuItems(), 'Sort by')).toBe(false)
    // the rest of the menu is untouched — only the ordering rows go
    expect(
      hasMenuItem(display.contextMenuItems(), 'Open feature details'),
    ).toBe(true)
  })

  // `rpcProps()` is the fetch cache key (serialized by `rpcPropsCacheKey`), so
  // anything in it that the worker then throws away buys a refetch for nothing.
  // Chain mode forces soft clipping off and drops the sort tag, so both have to
  // be projected the same way here.
  test('the sort tag leaves the fetch key when chain mode drops it', () => {
    const display = createDisplay()
    display.setSortSlot({
      type: 'tag',
      pos: 50,
      refName: 'ctgA',
      assemblyName: 'volvox',
      tag: 'HP',
    })
    expect(display.rpcProps().sortTag).toBe('HP')

    display.setLinkedReads('normal')
    expect(display.rpcProps().sortTag).toBeUndefined()
  })

  // The collapse is the same shape of no-op, and the one you can arrive at with
  // the slot already on: tick it under a chain-consistent grouping, then switch
  // to linked reads. The menu row goes with `canCollapseGroupRows`, so from
  // there it can't be unticked — and `collapseGroupRows` has to answer "is the
  // collapse IN EFFECT", since the layout lays chains out as true stacks
  // whatever the slot says and the label chip words its height button off this.
  test('the collapse stops being in effect when chain mode starts', () => {
    const display = createDisplay()
    display.setGroupBy({ type: 'tag', tag: 'HP' })
    display.setCollapseGroupRows(true)
    expect(display.collapseGroupRows).toBe(true)
    expect(display.canCollapseGroupRows).toBe(true)
    expect(
      hasMenuItem(display.trackMenuItems(), 'Collapse groups to one row'),
    ).toBe(true)

    display.setLinkedReads('normal')
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
    display.setLinkedReads('normal')
    const before = JSON.stringify(display.rpcProps())

    display.setShowSoftClipping(true)
    expect(display.showSoftClipping).toBe(true)
    expect(display.rpcProps().showSoftClipping).toBe(false)
    expect(JSON.stringify(display.rpcProps())).toBe(before)

    // ...and it is a real fetch input again the moment the mode is left
    display.setLinkedReads('off')
    expect(display.rpcProps().showSoftClipping).toBe(true)
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

    display.setLinkedReads('normal')
    expect(display.bezierArcScope).toBe('crossRegion')
  })

  test('ticking curved connectors widens it back to every connection', () => {
    const display = createDisplay()
    display.setShowBezierConnections(true)
    expect(display.bezierArcScope).toBe('all')

    // and chain mode doesn't narrow an explicit choice
    display.setLinkedReads('normal')
    expect(display.bezierArcScope).toBe('all')
  })
})

// Proper-pair / singleton visibility reads as a "Show..." toggle, so it lives in
// the Show menu (not Read connections, not the filter submenu). "Filter by..."
// wraps the flag/tag dialog.
describe('read-category toggles + filter submenu', () => {
  test('proper-pairs / mate-less toggles are under "Show...", not "Read connections"', () => {
    const display = createDisplay()
    const items = display.trackMenuItems()
    const show = menuSubItems(items, 'Show...')
    expect(hasMenuItem(show, 'Show proper pairs')).toBe(true)
    expect(hasMenuItem(show, 'Show reads without a mate')).toBe(true)

    const readConnections = menuSubItems(items, 'Read connections')
    expect(hasMenuItem(readConnections, 'Show proper pairs')).toBe(false)
  })

  test('"Show proper pairs" flips the model slot', () => {
    const display = createDisplay()
    display.setDrawProperPairs(true)
    clickMenuItem(display.trackMenuItems(), 'Show proper pairs')
    expect(display.drawProperPairs).toBe(false)
  })

  // One item that opens the dialog directly — no single-child submenu — and its
  // label is the only place the track chrome admits a filter is hiding reads.
  test('"Filter by..." opens the dialog directly and counts active filters', () => {
    const display = createDisplay()
    expect(isMenuItemClickable(display.trackMenuItems(), 'Filter by...')).toBe(
      true,
    )

    display.setFilterBy({
      ...display.filterBy,
      readName: 'readA',
      tagFilters: [{ tag: 'HP', value: '1' }],
    })
    expect(
      findMenuItem(display.trackMenuItems(), 'Filter by... (2)'),
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
      anchor: { clientX: 10, clientY: 20 },
      hit: {
        block: makeContextMenuBlock(),
        genomicPos: 42,
        cigarHit: { type: 'mismatch', index: 0, position: 42, length: 1 },
      },
    })
    expect(display.contextMenuAnchor).toEqual({ clientX: 10, clientY: 20 })
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
      anchor: { clientX: 1, clientY: 2 },
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
      anchor: { clientX: 1, clientY: 2 },
      featureId: 'read1',
    })
    expect(display.contextMenuFeatureId).toBe('read1')
    expect(display.contextMenuFeature).toBeUndefined()
  })

  test('closeContextMenu wipes all context-menu state', () => {
    const display = createDisplay()
    display.openContextMenu({
      anchor: { clientX: 3, clientY: 4 },
      hit: {
        block: makeContextMenuBlock(),
        genomicPos: 9,
        cigarHit: { type: 'mismatch', index: 1, position: 9, length: 1 },
      },
      featureId: 'read1',
    })
    display.closeContextMenu()
    expect(display.contextMenuAnchor).toBeUndefined()
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
      anchor: { clientX: 3, clientY: 4 },
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
    display.setRpcData(0, {
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
    })
    display.setLoadedRegion(0, {
      refName: 'ctgA',
      start: 0,
      end: 10000,
      assemblyName: 'volvox',
    })
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
    display.setRpcData(0, {
      groups: [
        {
          key: '',
          label: '',
          data: {
            ...makeEmptyPileupData(),
            sashimiX1: new Uint32Array([100, 300]),
            sashimiX2: new Uint32Array([500, 700]),
            sashimiStrands: new Int8Array([0, 0]),
            sashimiCounts: new Uint32Array([20, 2]),
          },
        },
      ],
    })
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
    display.setLoadedRegion(0, {
      refName: 'ctgA',
      start: 0,
      end: 10000,
      assemblyName: 'volvox',
    })

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
      sashimiStrands: new Int8Array([0]),
      sashimiCounts: new Uint32Array([20]),
    })
    // interleaving as bare numbers (10k < 30k < 50k < 70k), but one per chrom
    display.setRpcData(0, {
      groups: [{ key: '', label: '', data: junction(10_000, 50_000) }],
    })
    display.setRpcData(1, {
      groups: [{ key: '', label: '', data: junction(30_000, 70_000) }],
    })
    display.setLoadedRegion(0, {
      refName: 'ctgA',
      start: 0,
      end: 100_000,
      assemblyName: 'volvox',
    })
    display.setLoadedRegion(1, {
      refName: 'ctgB',
      start: 0,
      end: 100_000,
      assemblyName: 'volvox',
    })

    expect(display.belowCoverageBands.hasSashimiBand).toBe(false)

    // the same two spans on ONE chromosome do interleave and claim the strip
    display.setLoadedRegion(1, {
      refName: 'ctgA',
      start: 0,
      end: 100_000,
      assemblyName: 'volvox',
    })
    expect(display.belowCoverageBands.hasSashimiBand).toBe(true)
  })
})

// `renderState.sections` is built from `sections`, which reads `groupOrder` and
// `groupLaidOutMap` — both derived from `rpcDataMap`. So the render autorun
// observes a data arrival through the render state itself, with no help from
// the `rpcDataMap.size === 0` first-paint gate in the render callback. Deleting
// that gate would therefore NOT stop this display double-drawing on arrival
// (agent-docs/reference/ARCHITECTURAL_LIMITS.md "A region arrival draws twice
// if the render callback reads `rpcDataMap`"). Band geometry has to follow the
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

  display.setRpcData(0, {
    groups: [{ key: '', label: '', data: makeEmptyPileupData() }],
  })
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
  function displayWithOneRead() {
    const display = createDisplay()
    // Tag coloring is the CPU-baked scheme `colorTagMap` feeds; set it before
    // seeding, since colorBy is an rpcProps (tier-1) setting and clears data.
    display.setColorScheme({ type: 'tag', tag: 'HP' })
    display.setRpcData(0, {
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
    })
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

    display.setColorScheme({ type: 'tag', tag: 'HP' })

    const after = region0(display)
    // Layout memoized across the recolor…
    expect(display.laidOutByGroupUncolored).toBe(beforeLayout)
    // …so the payload is a fresh object over the SAME layout arrays, which is
    // what lets the renderer rewrite the read pass alone.
    expect(after).not.toBe(before)
    expect(after.readYs).toBe(before.readYs)
    expect(after.mismatchYs).toBe(before.mismatchYs)
    expect(after.readTagColors).not.toBe(before.readTagColors)
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
    display.setRpcData(0, withMods('m'))
    expect(display.modificationsReady).toBe(true)
    expect(display.detectedModificationTypes).toEqual(['m'])
    // the colour the legend and the marks both resolve from the type code
    expect(display.detectedModifications.get('m')).toBe('rgb(255,0,0)')
  })

  // The reason for the change: pan off the locus carrying 6mA and the menu
  // must stop offering it.
  test('a type the new region does not carry is dropped', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m', 'a'))
    expect(display.detectedModificationTypes).toEqual(['m', 'a'])
    display.setRpcData(0, withMods('m'))
    expect(display.detectedModificationTypes).toEqual(['m'])
  })

  test('every loaded region contributes, deduped', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m'))
    display.setRpcData(1, withMods('m', 'h'))
    expect(display.detectedModificationTypes).toEqual(['m', 'h'])
    // dropping one region takes only what that region alone carried
    display.setRpcData(1, null)
    expect(display.detectedModificationTypes).toEqual(['m'])
  })

  // `modificationsReady` used to be set true by the fetch and never set back,
  // so it outlived its data: after a clear it still claimed an answer for reads
  // that were no longer loaded, and the menu skipped "Loading modifications..."
  // while the replacing fetch was in flight.
  test('clearing the data un-readies the answer', () => {
    const display = createDisplay()
    display.setRpcData(0, withMods('m'))
    display.clearDisplaySpecificData()
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
    display.setRpcData(0, {
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
    })
    expect(display.detectedModificationTypes).toEqual(['m', 'a'])
  })
})
