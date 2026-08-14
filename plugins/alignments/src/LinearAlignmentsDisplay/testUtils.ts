import { getClip, getLengthOnRef, SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { namesToBlock } from '../shared/readNameBlock.ts'
import { nextRefsToTable } from '../shared/readNextRefs.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette, RGBColor } from '../shaders/colors.ts'
import type { RenderState } from './renderers/rendererTypes.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
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
    colorNostrand: z,
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
    coverageIsLog: false,
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

// A full PileupDataResult with every array empty — the shape a fetch returns for
// a region with no reads. Tests that only care about a few fields spread this
// and override them, so seeding `setRpcData` exercises the real layout getters
// instead of throwing on a missing array. Like `makeTestPalette`, it stays an
// explicit literal (no cast) so it fails to compile when the result type grows.
export function makeEmptyPileupData(): PileupDataResult {
  return {
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    readFlags: new Uint16Array(0),
    readMapqs: new Uint8Array(0),
    readInsertSizes: new Float32Array(0),
    readPairOrientations: new Uint8Array(0),
    readStrands: new Int8Array(0),
    readInterchrom: new Uint8Array(0),
    readKeys: [],
    readIdPrefix: undefined,
    ...namesToBlock([]),
    readNextRefIds: new Int32Array(0),
    nextRefNames: [],
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
    numSegments: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint32Array(0),
    gapTypes: new Uint8Array(0),
    gapReadIndices: new Uint32Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchStrands: new Int8Array(0),
    mismatchReadIndices: new Uint32Array(0),
    mismatchFrequencies: new Uint8Array(0),
    mismatchQuals: new Uint8Array(0),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    softclipBaseReadIndices: new Uint32Array(0),
    interbasePositions: new Uint32Array(0),
    interbaseYs: new Uint16Array(0),
    interbaseLengths: new Uint32Array(0),
    interbaseTypes: new Uint8Array(0),
    interbaseReadIndices: new Uint32Array(0),
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(0),
    coverageDepths: new Float32Array(0),
    coverageFwdDepths: new Float32Array(0),
    coverageRevDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
    coverageStatsBinSize: 1,
    coverageStatsMins: new Float32Array(0),
    coverageStatsMaxs: new Float32Array(0),
    coverageStatsSums: new Float64Array(0),
    coverageStatsSumSqs: new Float64Array(0),
    coverageBinSize: 1,
    coverageGpuBinCount: 0,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(0),
    snpYOffsets: new Float32Array(0),
    snpHeights: new Float32Array(0),
    snpColorTypes: new Uint8Array(0),
    snpRelDepths: new Float32Array(0),
    snpPackedBuffer: new ArrayBuffer(0),
    interbaseCovPositions: new Uint32Array(0),
    interbaseCovYOffsets: new Float32Array(0),
    interbaseCovHeights: new Float32Array(0),
    interbaseCovColorTypes: new Uint8Array(0),
    interbaseMaxCount: 0,
    interbasePackedBuffer: new ArrayBuffer(0),
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
    readTagColors: new Uint32Array(0),
    readColorCategories: new Uint8Array(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    modificationReadIndices: new Uint32Array(0),
    perBaseQualPositions: new Uint32Array(0),
    perBaseQualYs: new Uint16Array(0),
    perBaseQualScores: new Uint8Array(0),
    perBaseQualReadIndices: new Uint32Array(0),
    perBaseLetterPositions: new Uint32Array(0),
    perBaseLetterYs: new Uint16Array(0),
    perBaseLetterBases: new Uint8Array(0),
    perBaseLetterReadIndices: new Uint32Array(0),
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint32Array(0),
    modCovRelDepths: new Float32Array(0),
    modCovPackedBuffer: new ArrayBuffer(0),
    sashimiX1: new Uint32Array(0),
    sashimiX2: new Uint32Array(0),
    sashimiStrands: new Int8Array(0),
    sashimiCounts: new Uint32Array(0),
    maxY: 0,
    numInsertions: 0,
    numSoftclips: 0,
    numHardclips: 0,
    detectedModifications: [],
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
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
): PileupDataResult {
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
 * Boots a real LinearAlignmentsDisplay inside a measured LinearGenomeView.
 *
 * For the cases that have to run through the model's own chain — `arcsByGroup`
 * → `sections` → `renderSections`, or the mouse handlers, which reach for
 * `getContainingView` and the view's `visibleRegions` — rather than by calling
 * a pure function with a hand-built argument. Both halves have their own tests
 * (`sectionLayout.test.ts`, `hitTest.test.ts`); this is for the wiring between
 * them, which is where the drift lives.
 *
 * The view is left at the default zoom deliberately: a case that projects bp to
 * screen has to say what scale it means, so it calls `view.zoomTo` itself.
 */
export function createTestAlignmentsDisplay() {
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

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        // the harness exercises the model and the hook; nothing mounts this
        ReactComponent: () => null,
      }),
  )

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
  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: () => Promise.resolve(undefined) },
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        isValidRefName: () => true,
      },
      widgets: new Map<string, unknown>(),
      selection: undefined as unknown,
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
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return {
    session,
    view,
    display: view.tracks[0]!.displays[0]!,
    openedWidgets,
  }
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
export function oneReadWithMate(mateBp?: number): PileupDataResult {
  return {
    ...makeEmptyPileupData(),
    readKeys: ['r0'],
    ...namesToBlock(['readA']),
    readPositions: new Uint32Array([1000, 1100]),
    readYs: new Uint16Array(1),
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
