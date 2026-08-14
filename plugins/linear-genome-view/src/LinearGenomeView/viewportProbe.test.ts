import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  BaseDisplay,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
// SCRATCH PROBE — not for landing. Asks whether the persisted viewport
// (offsetPx/bpPerPx) restores the same genomic window at a different width,
// and whether the snapshot path and the `loc` path agree.
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import TrackHeightMixin from '../BaseLinearDisplay/models/TrackHeightMixin.tsx'
import { stateModelFactory } from './index.ts'
import volvoxDisplayedRegions from './volvoxDisplayedRegions.json' with { type: 'json' }

import type { LinearGenomeViewModel } from './index.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

type LGV = LinearGenomeViewModel

function stubDisplayStateModel(configSchema: AnyConfigurationSchemaType) {
  return types.compose(
    'LinearBareDisplay',
    types.compose(BaseDisplay, TrackHeightMixin()),
    types.model({
      type: types.literal('LinearBareDisplay'),
      configuration: ConfigurationReference(configSchema),
    }),
  )
}

function initialize() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const stubManager = new PluginManager()
  stubManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'BasicTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(stubManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'BasicTrack',
      configSchema,
      stateModel: createBaseTrackModel(stubManager, 'BasicTrack', configSchema),
    })
  })
  stubManager.addDisplayType(() => {
    const configSchema = ConfigurationSchema(
      'LinearBareDisplay',
      { height: { type: 'number', defaultValue: 100 } },
      { explicitIdentifier: 'displayId', explicitlyTyped: true },
    )
    return new DisplayType({
      name: 'LinearBareDisplay',
      configSchema,
      stateModel: stubDisplayStateModel(configSchema),
      trackType: 'BasicTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
    })
  })
  stubManager.createPluggableElements()
  stubManager.configure()

  const Assembly = types
    .model({ name: types.maybe(types.string) })
    .volatile(() => ({
      regions: volvoxDisplayedRegions,
      initialized: true,
      statusMessage: undefined as string | undefined,
      statusProgress: undefined as number | undefined,
    }))
    .views(() => ({
      getCanonicalRefName(refName: string) {
        const canonical: Record<string, string> = {
          ctga: 'ctgA',
          ctgb: 'ctgB',
        }
        return canonical[refName.toLowerCase()]
      },
    }))
    .actions(() => ({
      async load() {},
      setStatus() {},
    }))

  const AssemblyManager = types
    .model({ assemblies: types.map(Assembly) })
    .views(self => ({
      get assemblyNameMap() {
        return Object.fromEntries([...self.assemblies.entries()])
      },
    }))
    .actions(self => ({
      isValidRefName(str: string) {
        return str === 'ctgA' || str === 'ctgB'
      },
      get(str: string) {
        return self.assemblies.get(str)
      },
      loadingAssembly() {
        return undefined
      },
      async waitForAssembly(str: string) {
        return self.assemblies.get(str)
      },
    }))

  const LinearGenomeModel = stateModelFactory(stubManager)
  const Session = types
    .model({
      name: 'testSession',
      rpcManager: 'rpcManagerExists',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
      widgets: types.map(types.frozen<{ type: string; id: string }>()),
      minimized: types.optional(types.boolean, false),
      highlightsVisible: types.optional(types.boolean, true),
      assemblyManager: types.optional(AssemblyManager, {
        assemblies: {
          // @ts-expect-error
          volvox: { name: 'volvox', regions: volvoxDisplayedRegions },
        },
      }),
    })
    .views(self => ({
      get views() {
        return self.view ? [self.view] : []
      },
      get visibleWidget() {
        return [...self.widgets.values()].at(-1)
      },
      getTrackById() {
        return undefined
      },
      getDisplayTypeDefault() {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: LGV) {
        self.view = view
        return view
      },
      notifyError(message: string) {
        console.error(message)
      },
      addWidget(typeName: string, id: string) {
        const widget = { type: typeName, id }
        self.widgets.set(id, widget)
        return widget
      },
      showWidget() {},
      hideWidget() {},
      minimizeWidgetDrawer() {},
      setHighlightsVisible() {},
      revealHighlights() {},
    }))

  return { Session, LinearGenomeModel }
}

const REGION = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50000,
}

function makeView(id: string, width: number) {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({ configuration: {} }).setView(
    LinearGenomeModel.create({ id, type: 'LinearGenomeView' }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([REGION])
  return model
}

// left/right genomic edge of what is actually on screen
function window(model: LGV) {
  const l = model.pxToBp(0)
  const r = model.pxToBp(model.width)
  return { start: Math.round(l.coord), end: Math.round(r.coord) }
}

test('PROBE: snapshot restore at a narrower width shows a different window', () => {
  const wide = makeView('probe-wide', 1000)
  wide.navTo({ refName: 'ctgA', start: 10000, end: 20000 })
  const authored = window(wide)
  const snap = getSnapshot(wide)

  // restore that snapshot into a narrower viewport, as a share link would
  const { Session, LinearGenomeModel } = initialize()
  const restored = Session.create({ configuration: {} }).setView(
    LinearGenomeModel.create({
      ...snap,
      id: 'probe-restored',
      type: 'LinearGenomeView',
    }),
  )
  restored.setWidth(500)
  const restoredWindow = window(restored)

  // the same location asked for as a `loc`, at the narrow width
  const viaLoc = makeView('probe-loc', 500)
  viaLoc.navTo({ refName: 'ctgA', start: 10000, end: 20000 })
  const locWindow = window(viaLoc)

  console.log('PROBE RESULTS')
  console.log('  authored @1000px :', JSON.stringify(authored))
  console.log('  snapshot  @500px :', JSON.stringify(restoredWindow))
  console.log('  loc path  @500px :', JSON.stringify(locWindow))
  console.log(
    '  persisted snapshot viewport keys:',
    JSON.stringify({
      offsetPx: (snap as { offsetPx?: number }).offsetPx,
      bpPerPx: (snap as { bpPerPx?: number }).bpPerPx,
    }),
  )

  // documents current behavior; not an assertion of correctness
  expect({ authored, restoredWindow, locWindow }).toBeTruthy()
})

test('PROBE: live resize keeps scale and left edge, not the window', () => {
  const m = makeView('probe-resize', 1000)
  m.navTo({ refName: 'ctgA', start: 10000, end: 20000 })
  const before = { ...window(m), bpPerPx: m.bpPerPx }
  m.setWidth(500)
  const after = { ...window(m), bpPerPx: m.bpPerPx }
  console.log('RESIZE PROBE')
  console.log('  @1000px:', JSON.stringify(before))
  console.log('  @500px :', JSON.stringify(after))
  expect(after).toBeTruthy()
})

test('PROBE: does a narrowing resize leave bpPerPx above maxBpPerPx?', () => {
  const m = makeView('probe-clamp', 2000)
  m.showAllRegions()
  const wide = { bpPerPx: m.bpPerPx, maxBpPerPx: m.maxBpPerPx }
  m.setWidth(200)
  const narrow = { bpPerPx: m.bpPerPx, maxBpPerPx: m.maxBpPerPx }
  console.log('CLAMP PROBE')
  console.log('  @2000px:', JSON.stringify(wide))
  console.log('  @200px :', JSON.stringify(narrow))
  console.log(
    '  bpPerPx now exceeds maxBpPerPx:',
    narrow.bpPerPx > narrow.maxBpPerPx,
  )
  expect(narrow).toBeTruthy()
})

test('PROBE: multi-region window is lossless as linearized bp', () => {
  const { Session, LinearGenomeModel } = initialize()
  const m = Session.create({ configuration: {} }).setView(
    LinearGenomeModel.create({ id: 'probe-multi', type: 'LinearGenomeView' }),
  )
  m.setWidth(800)
  m.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 50000 },
  ])
  m.setNewView(30, 900) // straddles the region boundary
  const linStart = m.offsetPx * m.bpPerPx
  const linWidth = m.width * m.bpPerPx
  // round-trip through the proposed representation at a DIFFERENT width
  const newWidth = 400
  const rtBpPerPx = linWidth / newWidth
  const rtOffsetPx = linStart / rtBpPerPx
  console.log('MULTI-REGION PROBE')
  console.log(
    '  stored px  :',
    JSON.stringify({ offsetPx: m.offsetPx, bpPerPx: m.bpPerPx }),
  )
  console.log('  as interval:', JSON.stringify({ linStart, linWidth }))
  console.log('  edges @800 :', JSON.stringify(window(m)))
  m.setNewView(rtBpPerPx, rtOffsetPx)
  m.setWidth(newWidth)
  console.log(
    '  edges @400 after interval round-trip:',
    JSON.stringify(window(m)),
  )
  expect(linWidth).toBeGreaterThan(0)
})
