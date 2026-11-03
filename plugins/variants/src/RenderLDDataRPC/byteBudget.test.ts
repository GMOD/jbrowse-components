import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'

import VariantsPlugin from '../index.ts'
import RenderLDData from './RenderLDData.ts'

async function execute(
  file: string,
  type: string,
  byteLimit: number | undefined,
) {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const ldLocation = require.resolve(`../PlinkLDAdapter/test_data/${file}`)
  const location = { localPath: ldLocation, locationType: 'LocalPathLocation' }
  const result = await new RenderLDData(pluginManager).execute({
    sessionId: `byteBudget-${type}-${byteLimit}`,
    adapterConfig:
      type === 'PlinkLDTabixAdapter'
        ? {
            type,
            ldLocation: location,
            index: {
              location: {
                localPath: `${ldLocation}.tbi`,
                locationType: 'LocalPathLocation',
              },
            },
          }
        : { type, ldLocation: location },
    regions: [{ assemblyName: 'a', refName: '1', start: 0, end: 5000 }],
    originBp: 0,
    spanBp: 5000,
    field: 'r2',
    layout: 'columns',
    byteLimit,
  })
  return isRegionRefused(result)
    ? { refused: result, loaded: undefined }
    : { refused: undefined, loaded: unwrapRpcResult(result) }
}

test('a tabix region over the byte budget is refused before any pair is read', async () => {
  const { refused, loaded } = await execute(
    'dprime.ld.gz',
    'PlinkLDTabixAdapter',
    1,
  )
  expect(loaded).toBeUndefined()
  expect(refused?.regionTooLarge).toBe(true)
  expect(refused?.bytes).toBeGreaterThan(1)
})

test('a tabix region under the byte budget loads and reports its bytes', async () => {
  const { loaded } = await execute(
    'dprime.ld.gz',
    'PlinkLDTabixAdapter',
    1_000_000,
  )
  expect(loaded?.snps.length).toBeGreaterThan(0)
  expect(loaded?.bytes).toBeGreaterThan(0)
})

test('an adapter with no index estimate is never refused', async () => {
  const { loaded } = await execute('example.ld', 'PlinkLDAdapter', 1)
  expect(loaded?.snps.length).toBeGreaterThan(0)
  expect(loaded?.bytes).toBeUndefined()
})
