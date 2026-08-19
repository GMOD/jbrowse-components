import {
  getClip,
  getLengthOnRef,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_PAIRED,
} from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { baseWorkerPileupData } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { namesToBlock } from '../shared/readNameBlock.ts'
import { nextRefsToTable } from '../shared/readNextRefs.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette, RGBColor } from '../shaders/colors.ts'
import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { RenderState } from './renderers/rendererTypes.ts'
import type { MenuDivider, MenuItem, MenuSubHeader } from '@jbrowse/core/ui'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { IAnyModelType, Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// A full ColorPalette with every channel zeroed, for tests that only assert on
// a few roles. Pass `overrides` to set the colors a case actually checks; the
// explicit literal (no cast) keeps it type-safe as ColorPalette gains fields.
export function makeTestPalette(
  overrides: Partial<ColorPalette> = {},
): ColorPalette {
  const z: RGBColor = [0, 0, 0]
  return {
    colorFwdStrand: z,
    colorRevStrand: z,
    colorNeutralRead: z,
    colorPairLR: z,
    colorPairRL: z,
    colorPairRR: z,
    colorPairLL: z,
    colorBaseA: z,
    colorBaseC: z,
    colorBaseG: z,
    colorBaseT: z,
    colorBaseN: z,
    colorInsertion: z,
    colorDeletion: z,
    colorSkip: z,
    colorSoftclip: z,
    colorHardclip: z,
    colorInsertionIndicator: z,
    colorSoftclipIndicator: z,
    colorHardclipIndicator: z,
    colorCoverage: z,
    colorModificationFwd: z,
    colorModificationRev: z,
    colorMutedSnpBase: z,
    colorLongInsert: z,
    colorShortInsert: z,
    colorSupplementary: z,
    colorSplitInversion: z,
    colorUnmappedMate: z,
    colorInterchrom: z,
    colorFlatConnector: z,
    colorConnectingLine: z,
    colorOverlap: z,
    colorOverlapTint: z,
    ...overrides,
  }
}

/**
 * A full `RenderState` with everything off and one full-height section, for
 * tests that drive a real renderer and care about a handful of fields.
 *
 * An explicit literal rather than a cast, for `makeTestPalette`'s reason: a
 * `as unknown as RenderState` fixture silently stops covering a field the type
 * gains, and the renderers read this straight through to `drawSection` — the
 * shape that bit was `selectedChainReadIds`, absent from a hand-built state and
 * dereferenced unconditionally by `getSelectionBounds`.
 */
export function makeTestRenderState(
  overrides: Partial<RenderState> = {},
): RenderState {
  return {
    canvasWidth: 200,
    canvasHeight: 100,
    scrollTop: 0,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 1,
    showCoverage: false,
    coverageHeight: 0,
    coverageYOffset: 0,
    coverageMinDepth: undefined,
    coverageMaxDepth: undefined,
    coverageScaleType: 0 as const,
    coverageSymlogConstant: 1,
    coverageSnpMinFrequency: 0,
    showMismatches: false,
    filterMismatchesByFrequency: false,
    mismatchAlpha: false,
    showSoftClipping: false,
    showInterbaseIndicators: false,
    showModifications: false,
    showPerBaseQuality: false,
    showPerBaseLetter: false,
    selectedChainReadIds: [],
    selectedFeatureId: undefined,
    colors: makeTestPalette(),
    chainMode: false,
    showLinkedReadLines: false,
    collapseGroupRows: false,
    readConnectionsLineWidth: 1,
    readConnections: 'off',
    readConnectionsDown: false,
    readConnectionsHeight: 0,
    pileupTopOffset: 0,
    coverageTopOffset: 0,
    showOutline: false,
    sections: [
      {
        pileupTopOffset: 0,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: 0,
        pileupClipTop: 0,
        pileupClipHeight: 100,
      },
    ],
    ...overrides,
  }
}

// The shape a fetch returns for a region with no reads. Tests that only care
// about a few fields spread this and override them, so seeding `setRpcData`
// exercises the real layout getters instead of throwing on a missing array.
//
// `baseWorkerPileupData` rather than a second empty literal of its own: adding a
// required field to the worker's payload should break in one place, and that
// place is next to the type.
export function makeEmptyPileupData(): WorkerPileupData {
  return baseWorkerPileupData(0)
}

/**
 * One alignment record as `samtools view` prints it, reduced to the columns the
 * connection and chaining code actually consults. Lets a test be built out of
 * real records copied from a real file rather than out of invented numbers: see
 * the `realReads.*.test.ts` fixtures, which carry the samtools command that
 * produced them.
 *
 * `strand` is carried rather than derived from `flag`, because converting the
 * reverse flag to a strand is the adapter's job and no other layer is allowed
 * to redo it (see the plugin's CLAUDE.md).
 */
export interface SamRecordFixture {
  name: string
  flag: number
  strand: number
  /** 1-based POS, exactly as the record spells it. */
  pos: number
  CIGAR: string
  /** SA tag value, `''` when the record carries none. */
  SA: string
}

/**
 * The fetch result those records would arrive as. The alignment span and the
 * read-order sort key are derived here by the same `getLengthOnRef` / `getClip`
 * calls `extractFeatureArrays` makes in the worker, so a fixture pins the
 * clip-frame convention instead of assuming one.
 */
export function pileupDataFromSamRecords(
  records: SamRecordFixture[],
): WorkerPileupData {
  const n = records.length
  const readPositions = new Uint32Array(n * 2)
  const readFlags = new Uint16Array(n)
  const readStrands = new Int8Array(n)
  const readClipAtStart = new Uint32Array(n)
  for (const [i, rec] of records.entries()) {
    const start = rec.pos - 1
    readPositions[i * 2] = start
    readPositions[i * 2 + 1] = start + getLengthOnRef(rec.CIGAR)
    readFlags[i] = rec.flag
    readStrands[i] = rec.strand
    readClipAtStart[i] = getClip(rec.CIGAR, rec.strand)
  }
  return {
    ...makeEmptyPileupData(),
    readPositions,
    readFlags,
    readStrands,
    readClipAtStart,
    // ids are per-record and distinct; names are the QNAME, which split
    // segments of one read share and which is what groups them
    readKeys: records.map((_, i) => `id${i}`),
    readIdPrefix: undefined,
    ...namesToBlock(records.map(rec => rec.name)),
    readSuppAlignments: records.map(rec => rec.SA),
  }
}

/**
 * The half of a display test's setup that says nothing about the test.
 *
 * Registering the two pluggable types, building the LGV model against them,
 * creating the track config, and the session skeleton every one of these needs
 * (`view`, `configuration`, `getTrackById`, `setView`) were written out
 * longhand in ten files. They were not *quite* copies: the same
 * `addDisplayType` is an arrow in seven and a block in two, one comment is
 * reworded three ways, and the drift was invisible because nothing here has
 * any meaning to disagree about.
 *
 * What is deliberately NOT here is the rest of the session stub — the
 * `rpcManager`, the `assemblyManager` and its assembly's extent, the theme, the
 * notify hooks. That is where a display test says what world it is in, and the
 * ten files genuinely disagree: assemblies from 50kb to 10Mb, an rpcManager
 * that answers and one that would throw if called, a session that can host a
 * widget and one that cannot. Folding those into options here would turn ten
 * honest stubs into one fixture with eight flags, which is the same complexity
 * spent worse. So callers compose onto `baseSession`:
 *
 * ```
 * const { pluginManager, LinearGenomeModel, baseSession, mount } = bootAlignmentsDisplay()
 * const Session = baseSession.volatile(() => ({ rpcManager: { call: jest.fn() } }))
 * const { session, view, display } = mount(Session)
 * ```
 *
 * `mount` leaves the view UNMEASURED, because "no width, no displayed regions"
 * is a state some of these tests are specifically about (a slot read before
 * init). Measuring it is `applyView`, or the caller's own `setWidth` /
 * `setDisplayedRegions`, which is also where the region extent gets stated.
 */
export function bootAlignmentsDisplay({
  trackConfig: trackConfigExtra = {},
  register,
}: {
  // merged into the track's config snapshot — an `adapter`, or a `displays`
  // list whose entries a view-level display then references by id
  trackConfig?: Record<string, unknown>
  // anything else this test's plugin manager needs, registered before
  // `createPluggableElements` closes it
  register?: (pluginManager: PluginManager) => void
} = {}) {
  const pluginManager = new PluginManager()
  register?.(pluginManager)
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

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        // these harnesses exercise the model; nothing mounts this
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfig = pluginManager.pluggableConfigSchemaType('track').create(
    {
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      ...trackConfigExtra,
    },
    { pluginManager },
  )

  const baseSession = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
      // same shape as BaseSession's preferencesOverrides.displayTypeDefaults:
      // displayType -> slot -> value, reassigned wholesale so a display getter
      // tracks it reactively.
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
    })
    .views(self => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // Every promotable slot read walks the cascade through this, and
      // `resolveSlotIn` calls it UNCONDITIONALLY — a session without it doesn't
      // fall back, it throws `getDisplayTypeDefault is not a function` from
      // somewhere that looks nothing like the test. So it is the real store for
      // everyone rather than a stub for most and an implementation for the one
      // file about promotion; empty, it answers `undefined` for every slot,
      // which is what a stub was standing in for anyway.
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
      },
    }))

  // Generic over the composed model, so a caller's own volatiles and actions
  // stay typed on the session it gets back; intersected with the base's
  // instance because that is what supplies `setView` here.
  function mount<T extends IAnyModelType>(
    Session: T,
    displaySnapshot: Record<string, unknown> = {},
  ) {
    const session = Session.create(
      { configuration: {} },
      {
        pluginManager,
      },
    ) as Instance<T> & Instance<typeof baseSession>
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'AlignmentsTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearAlignmentsDisplay', ...displaySnapshot }],
          },
        ],
      }),
    )
    // `displays` is typed as the registry's loose display union, so every method
    // read off it comes back untyped — which is why cases used to cast the
    // result of `contextMenuItems()`/`trackMenuItems()` item by item. The model
    // itself declares `MenuItem[]`; naming the type once here is what lets a
    // case read it.
    return {
      session,
      view,
      display: view.tracks[0]!.displays[0]! as LinearAlignmentsDisplayModel,
    }
  }

  return { pluginManager, LinearGenomeModel, trackConfig, baseSession, mount }
}

/**
 * A display over a 10Mb assembly whose `rpcManager.call` is a spy: the world
 * the two fetch-behaviour suites need, which they had written out identically
 * to the byte (`zoomInvalidation`, `derivedRegionTooLarge` — the first one's
 * comment already said "same shape as" the second).
 *
 * Hands back a `createDisplay` rather than a display, because those suites
 * build several independent ones against one registration, and the spy so a
 * case can read what the display asked for.
 */
export function createRpcTestEnvironment() {
  const { baseSession, mount } = bootAlignmentsDisplay()
  const mockRpcCall = jest.fn()
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
    getGeneticCodeId: () => undefined,
    configuration: { sequence: undefined },
  }
  const Session = baseSession
    .volatile(() => ({
      rpcManager: { call: mockRpcCall },
      theme: createJBrowseTheme(),
      palette: resolvePalette(),
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        waitForAssembly: () => Promise.resolve(asm),
        isValidRefName: () => true,
      },
    }))
    .actions(() => ({
      notify() {},
      notifyError() {},
      queueDialog() {},
    }))

  function createDisplay() {
    const { session, view, display } = mount(Session)
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
    ])
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}

/**
 * Boots a real LinearAlignmentsDisplay inside a measured LinearGenomeView, with
 * a session that can host a widget and hold a selection.
 *
 * For the cases that have to run through the model's own chain — `arcsByGroup`
 * → `sections` → `renderSections`, or the mouse handlers, which reach for
 * `getContainingView` and the view's `visibleRegions` — rather than by calling
 * a pure function with a hand-built argument. Both halves have their own tests
 * (`sectionLayout.test.ts`, `hitTest.test.ts`); this is for the wiring between
 * them, which is where the drift lives.
 *
 * The view is left at the default zoom deliberately: a case that projects bp to
 * screen has to say what scale it means, so it calls `applyView` itself.
 */
export function createTestAlignmentsDisplay() {
  const { baseSession, mount } = bootAlignmentsDisplay()

  // `arcsByGroup` normalizes SA/RNEXT refNames through the assembly, so the mock
  // has to answer `initialized` + `getCanonicalRefName2`.
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  // Every widget `openFeatureWidget` opened, in order — what a click that lands
  // on a coverage bin / interbase bar / read produces, and the only externally
  // visible trace of one. `widgets` has to be present for
  // `isSessionModelWithWidgets` to answer at all, and without it the whole
  // open is a silent no-op that a test can't tell from a suppressed click.
  const openedWidgets: {
    type: string
    featureData: SimpleFeatureSerialized
  }[] = []
  const Session = baseSession
    .volatile(() => ({
      rpcManager: { call: () => Promise.resolve(undefined) },
      // `colorPalette` derives from the session's, so without it the harness
      // boots a display that throws the moment a test reads any getter
      // resolving a colour — the cross-region arc geometry being the first.
      palette: resolvePalette(),
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        isValidRefName: () => true,
      },
      widgets: new Map<string, unknown>(),
      selection: undefined as unknown,
    }))
    .actions(self => ({
      setSelection(thing: unknown) {
        self.selection = thing
      },
      clearSelection() {
        self.selection = undefined
      },
      addWidget(
        type: string,
        id: string,
        initialState: { featureData: SimpleFeatureSerialized },
      ) {
        openedWidgets.push({ type, featureData: initialState.featureData })
        return { type, id }
      },
      showWidget() {},
    }))

  const { session, view, display } = mount(Session)
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return { session, view, display, openedWidgets }
}

/**
 * A built menu row, minus the two kinds that carry no state and are never what
 * a lookup by label means. Everything left derives from `BaseMenuItem`, so
 * `label`, `disabled` and `disabledHelpText` are all readable without narrowing.
 */
export type BuiltMenuItem = Exclude<MenuItem, MenuDivider | MenuSubHeader>

/**
 * Find a row by label, at any depth.
 *
 * Typed against the real `MenuItem` union rather than a hand-rolled shim of it:
 * three suites here had grown their own `MenuNode`, which only type-checked
 * because the harness handed out an untyped display. `label` is a `ReactNode`
 * on the union (a row may render an element), so this matches the string rows,
 * which is what every caller means by a label.
 */
export function findMenuItem(
  items: MenuItem[],
  label: string,
): BuiltMenuItem | undefined {
  for (const item of items) {
    if (item.type === 'divider' || item.type === 'subHeader') {
      continue
    }
    if (item.label === label) {
      return item
    }
    const found =
      'subMenu' in item ? findMenuItem(item.subMenu, label) : undefined
    if (found) {
      return found
    }
  }
  return undefined
}

export function hasMenuItem(items: MenuItem[], label: string) {
  return findMenuItem(items, label) !== undefined
}

/** The rows nested under `label`, or [] where it isn't a submenu. */
export function menuSubItems(items: MenuItem[], label: string): MenuItem[] {
  const found = findMenuItem(items, label)
  return found && 'subMenu' in found ? found.subMenu : []
}

/**
 * Click the row labelled `label`, failing loudly when there isn't one or it
 * isn't clickable — a `?.onClick?.()` that silently found nothing passes the
 * assertion after it for the wrong reason.
 */
export function clickMenuItem(items: MenuItem[], label: string) {
  const found = findMenuItem(items, label)
  if (!found || !('onClick' in found)) {
    throw new Error(`no clickable menu item labeled ${label}`)
  }
  found.onClick()
}

/** Whether `label` names a row that would do something when clicked. */
export function isMenuItemClickable(items: MenuItem[], label: string) {
  const found = findMenuItem(items, label)
  return found !== undefined && 'onClick' in found
}

/**
 * Put the view at a scale, and settle what a real one settles asynchronously.
 *
 * `coarseDynamicBlocks` is fed by a 500ms-debounced autorun, and it is what
 * `coverageStats` — hence `coverageDomain`, hence every drawn and hit-tested
 * bar height in the coverage band — is computed over. A test that only calls
 * `setNewView` gets an undefined domain and a band that hit-tests as if it had
 * no interbase bars in it at all, which looks like the marks being absent
 * rather than the view not having caught up. `moveTo` flushes it for the same
 * reason.
 */
export function applyView(
  view: LinearGenomeViewModel,
  bpPerPx: number,
  offsetPx: number,
) {
  view.setNewView(bpPerPx, offsetPx)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, bpPerPx)
}

/**
 * One read spanning 1000..1100. `mateBp` makes it a same-chromosome pair, which
 * is what `computeArcsFromPileupData` turns into an arc; without it the lane has
 * reads but no arc — the 'Not split' lane of a split-read grouping.
 */
export function oneReadWithMate(mateBp?: number): WorkerPileupData {
  return {
    ...makeEmptyPileupData(),
    readKeys: ['r0'],
    ...namesToBlock(['readA']),
    readPositions: new Uint32Array([1000, 1100]),
    readFlags: new Uint16Array([mateBp === undefined ? 0 : SAM_FLAG_PAIRED]),
    readMapqs: new Uint8Array(1),
    readStrands: new Int8Array([1]),
    readInsertSizes: new Float32Array([500]),
    readPairOrientations: new Uint8Array([1]),
    ...nextRefsToTable(mateBp === undefined ? [''] : ['ctgA']),
    readNextPositions:
      mateBp === undefined ? undefined : new Uint32Array([mateBp]),
  }
}

/**
 * The same read with its mate on ANOTHER contig — the interchromosomal
 * connection, which is the only family the cross-region overlay draws breakend
 * feet for, and which `oneReadWithMate` cannot express because it names `ctgA`.
 *
 * `strand` and `mateReverse` are the two inputs those feet are derived from. A
 * foot points along the ARM its junction keeps, and this family's endpoints are
 * the fragment's OUTER edges, so the direction is each read's own reading
 * direction negated (`pairOuterDir`, features/arcs/arcChains.ts): a case that
 * wants outward feet asks for a forward read with a reverse mate — the FR,
 * deletion-type signature — and one that wants parallel feet asks for two
 * forward.
 */
export function oneReadWithInterchromMate({
  mateRefName,
  mateBp,
  strand = 1,
  mateReverse = false,
}: {
  mateRefName: string
  mateBp: number
  strand?: number
  mateReverse?: boolean
}): WorkerPileupData {
  return {
    ...oneReadWithMate(mateBp),
    readStrands: new Int8Array([strand]),
    readFlags: new Uint16Array([
      SAM_FLAG_PAIRED | (mateReverse ? SAM_FLAG_MATE_REVERSE : 0),
    ]),
    // TLEN 0, which is what SAM writes across references and what the
    // interchromosomal branch of `resolveArcs` is built around
    readInsertSizes: new Float32Array([0]),
    ...nextRefsToTable([mateRefName]),
  }
}
