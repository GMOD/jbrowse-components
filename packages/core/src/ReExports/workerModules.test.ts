import reExportsList from './list.ts'
import modules from './modules.ts'
import { sharedModules } from './sharedModules.ts'
import { uiStub } from './uiStub.ts'
import workerModules from './workerModules.ts'

test('the worker publishes exactly the keys the main thread publishes', () => {
  expect(Object.keys(workerModules).sort()).toEqual([...reExportsList].sort())
  expect(Object.keys(workerModules).sort()).toEqual(Object.keys(modules).sort())
})

test('a non-UI entry is the same module in both realms', () => {
  for (const key of Object.keys(sharedModules)) {
    expect(workerModules[key]).toBe(modules[key as keyof typeof modules])
  }
  expect(workerModules['react-dom']).toBe(uiStub)
  expect(workerModules['@mui/material']).toBe(uiStub)
  expect(workerModules['@jbrowse/core/ui']).toBe(uiStub)
})

test('the stub survives what a plugin does with UI at module scope', async () => {
  const mui = workerModules['@mui/material'] as Record<string, unknown>
  const { Button, styled } = mui as {
    Button: (props: unknown) => unknown
    styled: (c: unknown) => (s: unknown) => unknown
  }
  expect(typeof Button).toBe('function')
  expect(styled(Button)({ margin: 1 })).toBe(uiStub)
  expect('Dialog' in mui).toBe(true)
  expect(`${mui.Dialog}`).toBe('')
  expect(await mui.something).toBe(uiStub)
  expect(new (mui.Thing as new () => unknown)()).toBe(uiStub)
})

// how `import { makeStyles } from 'tss-react/mui'` reaches JBrowseExports in a
// published plugin: esbuild's `__toESM` copies the module's own names onto a
// fresh object rather than reading through it. The stub reports `__esModule`,
// so this is the branch esbuild takes for it.
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

test("the stub survives esbuild's namespace wrapper", () => {
  const wrap = (name: string) => esbuildToESM(workerModules[name] as object)

  const { makeStyles } = wrap('tss-react/mui')
  expect(typeof makeStyles).toBe('function')
  expect((makeStyles as () => (rules: unknown) => unknown)()({})).toBe(uiStub)

  const mui = wrap('@mui/material')
  expect(typeof mui.Button).toBe('function')
  expect(typeof mui.default).toBe('function')
})
