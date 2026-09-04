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
    expect(workerModules[key]).toBe(modules[key as keyof typeof modules])
  }
})

test('a single-value UI module is the bare stub', () => {
  expect(workerModules['@mui/material/Button']).toBe(uiStub)
  expect(workerModules['@jbrowse/core/ui/BaseTooltip']).toBe(uiStub)
})

// esbuild's `__toESM` copies a module's own keys onto a fresh object, so a name
// the worker serves behind the bare stub is `undefined` at the import site
// rather than the stub -- a plugin reading it at module scope throws, and the
// worker fails to load naming that plugin. Driving this off `modules.ts`
// instead of off WORKER_NAMESPACE_NAMES' own keys is the point: iterating the
// hand list cannot see a module that is missing FROM the hand list, which is
// how `@mui/material/SvgIcon` shipped its `createSvgIcon` to the main thread
// and a bare stub to the worker.
const REACT_INTERNAL_KEYS = new Set([
  '$$typeof',
  '_debugInfo',
  '_init',
  '_payload',
  'contextTypes',
  'defaultProps',
  'displayName',
  'muiName',
  'propTypes',
  'render',
])

test('every name a served module publishes survives into the worker', () => {
  for (const [name, mod] of Object.entries(modules)) {
    if (name in sharedModules) {
      continue
    }
    const published = Object.keys(mod as object).filter(
      key => !REACT_INTERNAL_KEYS.has(key),
    )
    const served = Object.keys(WORKER_NAMESPACE_NAMES[name] ?? []).length
      ? [...WORKER_NAMESPACE_NAMES[name]!]
      : []
    expect({
      name,
      missing: published.filter(k => !served.includes(k)),
    }).toEqual({ name, missing: [] })
  }
})

test('a namespace-shaped UI module has the same own keys in both realms', () => {
  for (const name of Object.keys(WORKER_NAMESPACE_NAMES)) {
    const real = Object.keys(modules[name as keyof typeof modules] as object)
      .filter(key => !REACT_INTERNAL_KEYS.has(key))
      .sort()
    const stub = Object.keys(workerModules[name] as object).sort()
    expect(stub).toEqual(real)
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
