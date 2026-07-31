import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'
import { makeEmptyPileupData } from './testUtils.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Builds a real LinearAlignmentsDisplay so the cross-feature coupling that
// lives in the model actions (not the menu handlers) is tested against the
// actual model rather than a mock that would just reimplement it.
function createDisplay() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'AlignmentsTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'AlignmentsTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'AlignmentsTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearAlignmentsDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      // satisfies isSessionModel so getSession(view) resolves; the LGV
      // localStorage autorun calls getSession via the trackLabels getter.
      // `call` is replaced per test by the cases that drive an RPC.
      rpcManager: { call: jest.fn() },
      // `colorPalette` (and so `renderState`) derives from the session theme
      theme: createJBrowseTheme(),
      // the feature-details lookup asks for the region's sequence adapter, and
      // reports a failed lookup through notify
      assemblyManager: { get: () => undefined },
      notify: jest.fn(),
      notifyError: jest.fn(),
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // every promotable slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
    }))

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'AlignmentsTrack',
          configuration: 'test_track',
          displays: [{ type: 'LinearAlignmentsDisplay' }],
        },
      ],
    }),
  )
  // `renderState` reads `view.width`, which throws while volatileWidth is unset
  view.setWidth(800)
  return view.tracks[0]!.displays[0]!
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

// colorTagMap holds the values discovered for whichever CPU-baked scheme is
// active, and is both the paint source and the legend's swatch list. It only
// goes stale when that scheme changes.
describe('setColorScheme and the discovered-value map', () => {
  test('a different scheme clears the map', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'tag', tag: 'HP' })
    display.updateColorTagMap(['1', '2'])
    expect(Object.keys(display.colorTagMap)).toEqual(['1', '2'])

    display.setColorScheme({ type: 'tag', tag: 'RG' })
    expect(display.colorTagMap).toEqual({})
  })

  // Re-picking the radio already showing writes the same value, so nothing
  // refetches — clearing the map here left the legend blank until the next pan.
  test('re-picking the scheme in use keeps the map', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'mateRefName' })
    display.updateColorTagMap(['ctgA'])
    expect(Object.keys(display.colorTagMap)).toEqual(['ctgA'])

    display.setColorScheme({ type: 'mateRefName' })
    expect(Object.keys(display.colorTagMap)).toEqual(['ctgA'])
  })

  // Chromosome painting hashes names through getQueryColor rather than taking
  // the next palette slot, so the legend swatch matches the painted read.
  test('chromosome painting colors names by hash, tag values by palette slot', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'mateRefName' })
    display.updateColorTagMap(['ctgA'])
    const hashed = display.colorTagMap.ctgA

    display.setColorScheme({ type: 'tag', tag: 'RG' })
    display.updateColorTagMap(['ctgA'])
    expect(display.colorTagMap.ctgA).not.toBe(hashed)
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
interface MenuNode {
  label?: string
  disabled?: boolean
  disabledHelpText?: string
  onClick?: () => void
  subMenu?: MenuNode[]
}
function hasMenuLabel(items: MenuNode[], label: string): boolean {
  return items.some(
    i =>
      i.label === label || (i.subMenu ? hasMenuLabel(i.subMenu, label) : false),
  )
}
function findMenu(items: MenuNode[], label: string): MenuNode | undefined {
  return items.reduce<MenuNode | undefined>(
    (acc, i) =>
      acc ??
      (i.label === label
        ? i
        : i.subMenu
          ? findMenu(i.subMenu, label)
          : undefined),
    undefined,
  )
}

describe('Arc color menu visibility', () => {
  test('hidden when no read-connection overlay is active', () => {
    const display = createDisplay()
    display.setReadConnections('off')
    expect(hasMenuLabel(display.trackMenuItems(), 'Arc color')).toBe(false)
  })

  test('shown for read arcs', () => {
    const display = createDisplay()
    display.setReadConnections('arc')
    expect(hasMenuLabel(display.trackMenuItems(), 'Arc color')).toBe(true)
  })

  test('shown for read cloud', () => {
    const display = createDisplay()
    display.setReadConnections('cloud')
    expect(hasMenuLabel(display.trackMenuItems(), 'Arc color')).toBe(true)
  })
})

// Sort and feature-height act only on the pileup rows, so they grey out (with a
// tip) when the pileup band is hidden — mirrors the disabled band-options
// pattern. Group-by and filters are NOT gated: both still affect the coverage
// band when the pileup is off.
describe('pileup-only menus grey out when the pileup is hidden', () => {
  test.each(['Sort by...', 'Read height'])(
    '%s is enabled with the pileup shown, disabled when hidden',
    label => {
      const display = createDisplay()
      display.setShowPileup(true)
      expect(findMenu(display.trackMenuItems(), label)?.disabled).toBeFalsy()

      display.setShowPileup(false)
      const item = findMenu(display.trackMenuItems(), label)
      expect(item?.disabled).toBe(true)
      expect(item?.disabledHelpText).toBeTruthy()
    },
  )

  test.each(['Group by...', 'Filter by...'])(
    '%s stays enabled with the pileup hidden (still affects coverage)',
    label => {
      const display = createDisplay()
      display.setShowPileup(false)
      expect(findMenu(display.trackMenuItems(), label)?.disabled).toBeFalsy()
    },
  )
})

// Proper-pair / singleton visibility reads as a "Show..." toggle, so it lives in
// the Show menu (not Read connections, not the filter submenu). "Filter by..."
// wraps the flag/tag dialog.
describe('read-category toggles + filter submenu', () => {
  test('proper-pairs / mate-less toggles are under "Show...", not "Read connections"', () => {
    const display = createDisplay()
    const items = display.trackMenuItems()
    const show = findMenu(items, 'Show...')
    expect(hasMenuLabel(show?.subMenu ?? [], 'Show proper pairs')).toBe(true)
    expect(hasMenuLabel(show?.subMenu ?? [], 'Show reads without a mate')).toBe(
      true,
    )

    const readConnections = findMenu(items, 'Read connections')
    expect(
      hasMenuLabel(readConnections?.subMenu ?? [], 'Show proper pairs'),
    ).toBe(false)
  })

  test('"Show proper pairs" flips the model slot', () => {
    const display = createDisplay()
    display.setDrawProperPairs(true)
    findMenu(display.trackMenuItems(), 'Show proper pairs')?.onClick?.()
    expect(display.drawProperPairs).toBe(false)
  })

  // One item that opens the dialog directly — no single-child submenu — and its
  // label is the only place the track chrome admits a filter is hiding reads.
  test('"Filter by..." opens the dialog directly and counts active filters', () => {
    const display = createDisplay()
    expect(findMenu(display.trackMenuItems(), 'Filter by...')?.onClick).toEqual(
      expect.any(Function),
    )

    display.setFilterBy({
      ...display.filterBy,
      readName: 'readA',
      tagFilters: [{ tag: 'HP', value: '1' }],
    })
    expect(findMenu(display.trackMenuItems(), 'Filter by... (2)')).toBeDefined()
  })
})

// openContextMenu sets coord + block + hit kinds as one unit and resets the
// read feature. These invariants are what let the menu builder read a block
// without its hit going missing, and stop a repositioned menu from showing the
// previous read — behavior otherwise guarded only by a comment.
describe('openContextMenu atomic state and stale-read reset', () => {
  test('sets coord and hit fields together', () => {
    const display = createDisplay()
    display.openContextMenu({
      coord: [10, 20],
      cigarHit: { type: 'mismatch', index: 0, position: 42, length: 1 },
    })
    expect(display.contextMenuCoord).toEqual([10, 20])
    expect(display.contextMenuCigarHit).toEqual({
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
      coord: [1, 2],
      indicatorHit: {
        type: 'indicator',
        position: 5,
        indicatorType: 'insertion',
      },
    })
    expect(display.contextMenuFeature).toBeUndefined()
    expect(display.contextMenuIndicatorHit).toEqual({
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
    display.openContextMenu({ coord: [1, 2], featureId: 'read1' })
    expect(display.contextMenuFeatureId).toBe('read1')
    expect(display.contextMenuFeature).toBeUndefined()
  })

  test('closeContextMenu wipes all context-menu state', () => {
    const display = createDisplay()
    display.openContextMenu({
      coord: [3, 4],
      cigarHit: { type: 'mismatch', index: 1, position: 9, length: 1 },
      featureId: 'read1',
    })
    display.closeContextMenu()
    expect(display.contextMenuCoord).toBeUndefined()
    expect(display.contextMenuCigarHit).toBeUndefined()
    expect(display.contextMenuIndicatorHit).toBeUndefined()
    expect(display.contextMenuFeature).toBeUndefined()
    expect(display.contextMenuFeatureId).toBeUndefined()
    expect(display.contextMenuBlock).toBeUndefined()
  })
})

// What the display asks the adapter for when a menu item needs the whole
// feature behind an id.
describe('the feature-details lookup', () => {
  // One read, id 'read1', spanning 1000-5000 of a loaded ctgA region.
  function seedOneRead(display: ReturnType<typeof createDisplay>) {
    display.setRpcData(0, {
      groups: [
        {
          key: '',
          label: '',
          data: {
            ...makeEmptyPileupData(),
            readIds: ['read1'],
            readNames: ['readA'],
            readPositions: new Uint32Array([1000, 5000]),
            readYs: new Uint16Array([0]),
            readFlags: new Uint16Array([0]),
            readMapqs: new Uint8Array([60]),
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
