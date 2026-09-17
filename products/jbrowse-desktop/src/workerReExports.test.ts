import { uiStub } from '@jbrowse/core/ReExports/uiStub'
import { clipSyntenyFeature, getAlignmentOps } from '@jbrowse/synteny-core'

import modules from './reExports.generated.ts'
import workerModules from './workerReExports.generated.ts'

const packageKeys = Object.keys(modules).filter(
  k => k.startsWith('@jbrowse/') && !k.startsWith('@jbrowse/core/'),
)

const asNamespace = (value: unknown) => value as Record<string, unknown>

test('an RPC worker adapter reads the synteny clip helpers for real', () => {
  const synteny = asNamespace(workerModules['@jbrowse/synteny-core'])
  expect(synteny.clipSyntenyFeature).toBe(clipSyntenyFeature)
  expect(synteny.getAlignmentOps).toBe(getAlignmentOps)
  expect(synteny.AnchorsSelector).toBe(uiStub)
})

test('no name the worker stubs holds a primitive on the main thread', () => {
  const primitives = packageKeys.flatMap(key => {
    const main = asNamespace(modules[key])
    const worker = asNamespace(workerModules[key])
    return worker === uiStub
      ? []
      : Object.keys(worker)
          .filter(
            name =>
              worker[name] === uiStub &&
              main[name] !== null &&
              typeof main[name] !== 'object' &&
              typeof main[name] !== 'function',
          )
          .map(name => `${key}#${name}`)
  })
  expect(primitives).toEqual([])
})
