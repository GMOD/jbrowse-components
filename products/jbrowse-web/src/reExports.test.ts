import reExportsList from '@jbrowse/core/ReExports/list'
import { REACT_INTERNAL_KEYS, uiStub } from '@jbrowse/core/ReExports/uiStub'

import modules from './reExports.generated.ts'
import workerModules from './workerReExports.generated.ts'

// jbrowse-web bundles every served package, so its generated maps are the
// whole of list.ts. The names a stubbed module carries in the worker come
// from the generator's read of the module's source; what the main thread
// serves is the oracle.
test('jbrowse-web serves every key in the list, in both realms', () => {
  expect(Object.keys(modules).sort()).toEqual([...reExportsList].sort())
  expect(Object.keys(workerModules).sort()).toEqual([...reExportsList].sort())
})

function isStub(value: unknown) {
  return (
    value === uiStub ||
    (typeof value === 'object' &&
      value !== null &&
      Object.entries(value).every(
        ([k, v]) => (k === '__esModule' && v === true) || v === uiStub,
      ))
  )
}

function ownKeys(value: unknown) {
  return value !== null &&
    (typeof value === 'object' || typeof value === 'function')
    ? Object.keys(value)
        .filter(k => !REACT_INTERNAL_KEYS.has(k))
        .sort()
    : []
}

const packageKeys = Object.keys(modules).filter(
  k => k.startsWith('@jbrowse/') && !k.startsWith('@jbrowse/core/'),
)

test('a stubbed package module carries the same own keys in both realms', () => {
  const stubbed = packageKeys.filter(k => isStub(workerModules[k]))
  expect(stubbed.length).toBeGreaterThan(0)
  for (const key of stubbed) {
    expect({ key, names: ownKeys(workerModules[key]) }).toEqual({
      key,
      names: ownKeys(modules[key]),
    })
  }
})

test('a real package module is the same value in both realms', () => {
  const real = packageKeys.filter(k => !isStub(workerModules[k]))
  expect(real).toContain('@jbrowse/display-kit/MultiRegionDisplayMixin')
  for (const key of real) {
    const main = modules[key] as Record<string, unknown>
    const worker = workerModules[key] as Record<string, unknown>
    if (main !== worker) {
      for (const name of Object.keys(main)) {
        expect(worker[name]).toBe(main[name])
      }
    }
  }
})
