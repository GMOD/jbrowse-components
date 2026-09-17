import frameworkShared from './frameworkShared.ts'
import modules from './modules.ts'
import manifest from './reExports.generated.json'
import { REACT_INTERNAL_KEYS, uiStub } from './uiStub.ts'
import workerModules from './workerModules.ts'

const served: Record<
  string,
  { names: string[]; worker: string; stubbed?: string[]; uiVia?: string[] }
> = manifest.modules
const isShared = (key: string) =>
  key in served ? served[key]!.worker === 'real' : key in frameworkShared

// `default` is left out of a framework namespace: jest's CommonJS interop
// synthesizes one on `import * as` of a package (mobx-react) whose ESM build
// has none, and the generator read the ESM build.
function ownKeys(value: unknown, key: string) {
  return value !== null &&
    (typeof value === 'object' || typeof value === 'function')
    ? Object.keys(value)
        .filter(k => !REACT_INTERNAL_KEYS.has(k))
        .filter(k => k !== 'default' || key in manifest.modules)
        .sort()
    : []
}

test('the worker publishes exactly the keys the main thread publishes', () => {
  expect(Object.keys(workerModules).sort()).toEqual(Object.keys(modules).sort())
})

// A namespace served with `__esModule` beside a default is spread into a fresh
// object by each generated map, so it is the values that are compared.
test('a non-UI entry is the same module in both realms', () => {
  for (const key of Object.keys(modules).filter(isShared)) {
    const main = modules[key] as Record<string, unknown>
    const worker = workerModules[key] as Record<string, unknown>
    if (main !== worker) {
      expect({ key, keys: Object.keys(worker).sort() }).toEqual({
        key,
        keys: Object.keys(main).sort(),
      })
      for (const name of Object.keys(main)) {
        expect(worker[name]).toBe(main[name])
      }
    }
  }
})

// esbuild's `__toESM` copies a module's own keys onto a fresh object, so a name
// the worker serves behind the bare stub is `undefined` at the import site
// rather than the stub -- a plugin reading it at module scope throws, and the
// worker fails to load naming that plugin. The generator derives the stub's
// names from the module's source; what the main thread actually serves is the
// oracle, per module.
test('a stubbed entry carries the same own keys in both realms', () => {
  for (const key of Object.keys(modules).filter(k => !isShared(k))) {
    expect({ key, names: ownKeys(workerModules[key], key) }).toEqual({
      key,
      names: ownKeys(modules[key], key),
    })
  }
})

test('a stubbed entry with no named exports is the bare stub', () => {
  expect(workerModules['@mui/material/Button']).toBe(uiStub)
  expect(workerModules['@jbrowse/core/ui/BaseTooltip']).toBe(uiStub)
})

test('a rendering module serves the names the manifest stubs as the stub and the rest as themselves', () => {
  for (const key of Object.keys(modules).filter(k => !isShared(k))) {
    const entry = served[key]
    const stubbed = new Set(entry ? (entry.stubbed ?? entry.names) : [])
    const main = modules[key] as Record<string, unknown>
    const worker = workerModules[key] as Record<string, unknown>
    if (worker === uiStub || !entry) {
      for (const [name, value] of Object.entries(worker)) {
        expect(name === '__esModule' ? value : value === uiStub).toBe(true)
      }
    } else if (entry.names.length === 1 && entry.names[0] === 'default') {
      expect(worker).toBe(main)
    } else {
      for (const [name, value] of Object.entries(worker)) {
        if (name !== '__esModule') {
          expect({ key, name, stub: value === uiStub }).toEqual({
            key,
            name,
            stub: stubbed.has(name),
          })
          if (!stubbed.has(name)) {
            expect(value).toBe(main[name])
          }
        }
      }
    }
  }
})

test('a data name a rendering barrel re-exports from a module that does not render is real', () => {
  const ui = workerModules['@jbrowse/core/ui'] as Record<string, unknown>
  expect(served['@jbrowse/core/ui']!.worker).toBe('mixed')
  expect(ui.colorFwdStrand).toBe(
    (modules['@jbrowse/core/ui'] as Record<string, unknown>).colorFwdStrand,
  )
  expect(ui.Dialog).toBe(uiStub)
})

// What an adapter, an RPC method, a config schema or a state-model mixin reads
// in the worker. A module whose graph reaches react-dom, a Material UI
// component, the data grid or floating-ui is stubbed there, and a stub answers
// every read and call with itself — so a demotion costs a plugin silent zeros,
// not an error. One `export … from` naming a package barrel is enough to do it:
// `computeYTicks.ts` reaching the @jbrowse/display-ui barrel is what had the
// whole of @jbrowse/wiggle-core stubbed, config mixins included.
test('the modules a worker-side plugin reads are served for real', () => {
  const workerSide = [
    '@jbrowse/core/Plugin',
    '@jbrowse/core/configuration',
    '@jbrowse/core/data_adapters/BaseAdapter',
    '@jbrowse/core/data_adapters/dataAdapterCache',
    '@jbrowse/core/data_adapters/getFeatureAdapter',
    '@jbrowse/core/pluggableElementTypes',
    '@jbrowse/core/pluggableElementTypes/AdapterType',
    '@jbrowse/core/pluggableElementTypes/DisplayType',
    '@jbrowse/core/pluggableElementTypes/RpcMethodType',
    '@jbrowse/core/pluggableElementTypes/TrackType',
    '@jbrowse/core/pluggableElementTypes/ViewType',
    '@jbrowse/core/pluggableElementTypes/WidgetType',
    '@jbrowse/core/pluggableElementTypes/models',
    '@jbrowse/core/rpc/RpcRegistry',
    '@jbrowse/core/ui/palette',
    '@jbrowse/core/ui/theme',
    '@jbrowse/core/util',
    '@jbrowse/core/util/Base1DViewModel',
    '@jbrowse/core/util/color',
    '@jbrowse/core/util/io',
    '@jbrowse/core/util/layouts',
    '@jbrowse/core/util/librpc',
    '@jbrowse/core/util/mst-reflection',
    '@jbrowse/core/util/rxjs',
    '@jbrowse/core/util/tracks',
    '@jbrowse/core/util/types/mst',
    // the display layer a v5 track type is built on
    '@jbrowse/display-kit/MultiRegionDisplayMixin',
    '@jbrowse/display-kit/StoredHoverMixin',
    '@jbrowse/display-kit/TrackHeightMixin',
    '@jbrowse/display-kit/configSchema',
    '@jbrowse/display-kit/fetchEachRegion',
    '@jbrowse/display-ui/axisPlacement',
    '@jbrowse/display-ui/yAxisConstants',
    '@jbrowse/display-ui/yScaleTicks',
    '@jbrowse/render-core/marks',
    '@jbrowse/render-core/marks/backend',
    '@jbrowse/render-core/perRegionRenderingBackend',
    '@jbrowse/render-core/renderBlock',
    '@jbrowse/render-core/slangPass',
    // score math and the config mixins a wiggle-derived display composes
    '@jbrowse/wiggle-core',
    '@jbrowse/wiggle-core/constants',
    '@jbrowse/wiggle-core/normalize',
    '@jbrowse/wiggle-core/renderingBackendTypes',
    // cluster math an RPC method runs
    '@jbrowse/tree-sidebar/clusterMatrix',
    '@jbrowse/tree-sidebar/clusterProvenance',
    '@jbrowse/tree-sidebar/clusterUtils',
    '@jbrowse/tree-sidebar/hierarchy',
    '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields',
    '@jbrowse/tree-sidebar/rowSortColumn',
    '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields',
    '@jbrowse/tree-sidebar/treeSidebarGeometry',
    // plugin entries whose config schemas and mixins a derived plugin composes
    '@jbrowse/plugin-canvas',
    '@jbrowse/plugin-gwas',
    '@jbrowse/plugin-marks',
    '@jbrowse/plugin-variants',
    '@jbrowse/plugin-wiggle',
  ]
  expect(
    workerSide
      .filter(key => served[key]?.worker !== 'real')
      .map(key => ({ key, uiVia: served[key]?.uiVia })),
  ).toEqual([])
})
