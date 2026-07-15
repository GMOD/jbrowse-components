import { getSnapshot } from '@jbrowse/mobx-state-tree'

import rpcConfigSchema from './configSchema.ts'
import { readConfObject } from '../configuration/index.ts'

test('defaults strip to an empty snapshot', () => {
  expect(getSnapshot(rpcConfigSchema.create({}))).toEqual({})
})

test('an explicit defaultDriver is retained', () => {
  const config = rpcConfigSchema.create({ defaultDriver: 'WebWorkerRpcDriver' })
  expect(readConfObject(config, 'defaultDriver')).toBe('WebWorkerRpcDriver')
})

test('legacy drivers map is dropped and its workerCount hoisted', () => {
  const config = rpcConfigSchema.create({
    defaultDriver: 'WebWorkerRpcDriver',
    drivers: {
      WebWorkerRpcDriver: { type: 'WebWorkerRpcDriver', workerCount: 4 },
      MainThreadRpcDriver: { type: 'MainThreadRpcDriver' },
    },
  })
  expect(readConfObject(config, 'workerCount')).toBe(4)
  expect(getSnapshot(config)).toEqual({
    defaultDriver: 'WebWorkerRpcDriver',
    workerCount: 4,
  })
})
