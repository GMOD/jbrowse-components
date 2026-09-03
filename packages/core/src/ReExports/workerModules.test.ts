import { DOCUMENT_ONLY_NAMES } from './documentOnlyNames.ts'
import reExportsList from './list.ts'
import modules from './modules.ts'
import { sharedModules } from './sharedModules.ts'
import { uiStub } from './uiStub.ts'
import workerModules from './workerModules.ts'
import { WORKER_NAMESPACE_NAMES } from './workerNamespaceNames.ts'

test('the worker publishes exactly the keys the main thread publishes', () => {
  expect(Object.keys(workerModules).sort()).toEqual([...reExportsList].sort())
  expect(Object.keys(workerModules).sort()).toEqual(Object.keys(modules).sort())
})

test('a non-UI entry is the same module in both realms', () => {
  for (const key of Object.keys(sharedModules)) {
    if (!(key in DOCUMENT_ONLY_NAMES)) {
      expect(workerModules[key]).toBe(modules[key as keyof typeof modules])
    }
  }
})

// The one shape that is neither wholly shared nor wholly UI: a worker-safe
// module carrying a name whose implementation needs `document`. Both halves are
// worth pinning, because they fail in opposite directions -- a name missing from
// the main thread is an `undefined` inside a published plugin, and a name real
// in the worker is react-dom back on the worker's graph.
test('a document-only name is real on the main thread and stubbed in the worker', () => {
  for (const [key, names] of Object.entries(DOCUMENT_ONLY_NAMES)) {
    const real = modules[key as keyof typeof modules] as Record<string, unknown>
    const stub = workerModules[key] as Record<string, unknown>
    expect(Object.keys(stub).sort()).toEqual(Object.keys(real).sort())
    for (const name of names) {
      expect(typeof real[name]).toBe('function')
      expect(real[name]).not.toBe(uiStub)
      expect(stub[name]).toBe(uiStub)
    }
    for (const name of Object.keys(real).filter(n => !names.includes(n))) {
      expect(stub[name]).toBe(real[name])
    }
  }
})

// react-msaview's SVG export reads this off the `@jbrowse/core/util` namespace,
// and jbrowse-plugin-msaview and jbrowse-plugin-tview bundle react-msaview, so
// published copies of both are linked against the name. Dropping it from the
// barrel in 0d034e2bd8 broke their export on a v5 host; publishedPluginBreaks.json
// recorded it.
test('the util module a plugin links against still serves renderToStaticMarkup', () => {
  const util = modules['@jbrowse/core/util'] as Record<string, unknown>
  expect(typeof util.renderToStaticMarkup).toBe('function')
  // through the wrapper the shipped bundle actually reads it with: the entry is
  // a plain object rather than a module namespace, so pin that __toESM still
  // carries the name across
  expect(typeof esbuildToESM(util).renderToStaticMarkup).toBe('function')
})

test('a single-value UI module is the bare stub', () => {
  expect(workerModules['@mui/material/Button']).toBe(uiStub)
  expect(workerModules['@mui/material/SvgIcon']).toBe(uiStub)
  expect(workerModules['@jbrowse/core/ui/BaseTooltip']).toBe(uiStub)
})

test('a namespace-shaped UI module has the same own keys in both realms', () => {
  for (const name of Object.keys(WORKER_NAMESPACE_NAMES)) {
    const real = Object.keys(modules[name as keyof typeof modules] as object)
    const stub = Object.keys(workerModules[name] as object)
    expect(stub.sort()).toEqual(real.sort())
  }
})

test('every value in a namespace-shaped UI module is the stub', () => {
  for (const name of Object.keys(WORKER_NAMESPACE_NAMES)) {
    const mod = workerModules[name] as Record<string, unknown>
    for (const value of Object.values(mod)) {
      expect(value).toBe(uiStub)
    }
  }
})

test('the stub survives what a plugin does with UI at module scope', async () => {
  const mui = workerModules['@mui/material'] as Record<string, unknown>
  const styles = workerModules['@mui/material/styles'] as Record<
    string,
    unknown
  >
  const { Button } = mui as { Button: (props: unknown) => unknown }
  const { styled } = styles as {
    styled: (c: unknown) => (s: unknown) => unknown
  }
  expect(typeof Button).toBe('function')
  expect(styled(Button)({ margin: 1 })).toBe(uiStub)
  expect('Dialog' in mui).toBe(true)
  expect(`${mui.Dialog}`).toBe('')
  expect(await mui.Dialog).toBe(uiStub)
  expect(new (mui.Dialog as new () => unknown)()).toBe(uiStub)
  // a name genuinely absent from the served ABI -- not even the stub
  expect(mui.somethingNeverServed).toBeUndefined()
})

// How `import { makeStyles } from 'tss-react/mui'` reaches JBrowseExports in a
// published plugin: esbuild's `__toESM` copies the module's own names onto a
// fresh object rather than reading through it.
function esbuildToESM(mod: object) {
  const ns: Record<string, unknown> = Object.create(Object.getPrototypeOf(mod))
  for (const key of Object.getOwnPropertyNames(mod)) {
    Object.defineProperty(ns, key, {
      get: () => Reflect.get(mod, key),
      enumerable: true,
    })
  }
  return ns
}

// babel's interopRequireWildcard
function babelInteropRequireWildcard(mod: Record<string, unknown>) {
  const ns: Record<string, unknown> = {}
  for (const key in mod) {
    if (Object.prototype.hasOwnProperty.call(mod, key)) {
      ns[key] = mod[key]
    }
  }
  return ns
}

test.each([
  ['esbuild', esbuildToESM],
  ['babel/webpack', babelInteropRequireWildcard],
])("the stub survives %s's namespace wrapper", (_label, wrap) => {
  const { makeStyles } = wrap(
    workerModules['tss-react/mui'] as Record<string, unknown>,
  )
  expect(typeof makeStyles).toBe('function')
  expect((makeStyles as () => (rules: unknown) => unknown)()({})).toBe(uiStub)

  const mui = wrap(workerModules['@mui/material'] as Record<string, unknown>)
  expect(typeof mui.Button).toBe('function')
  expect(typeof mui.Dialog).toBe('function')
})

test('a plain-object copy of a namespace-shaped module keeps every name', () => {
  const copy = Object.assign({}, workerModules['tss-react/mui'] as object)
  expect(Object.keys(copy).sort()).toEqual(['cx', 'keyframes', 'makeStyles'])
  expect(typeof (copy as Record<string, unknown>).makeStyles).toBe('function')
})
