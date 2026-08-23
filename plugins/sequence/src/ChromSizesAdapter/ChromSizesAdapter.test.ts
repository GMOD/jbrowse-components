import { statusMessageText, statusSource } from '@jbrowse/core/util'

import Adapter from './ChromSizesAdapter.ts'
import configSchema from './configSchema.ts'

import type { RpcStatus } from '@jbrowse/core/util'

function makeAdapter() {
  return new Adapter(
    configSchema.create({
      chromSizesLocation: {
        localPath: require.resolve('./test_data/volvox.chrom.sizes'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

test('adapter can fetch sequence from volvox.chrom.sizes', async () => {
  const adapter = makeAdapter()

  const regions = await adapter.getRegions()
  expect(regions).toEqual([
    {
      refName: 'ctgA',
      start: 0,
      end: 50001,
    },
    {
      refName: 'ctgB',
      start: 0,
      end: 6079,
    },
  ])
})

test('names what it is downloading on the status channel', async () => {
  const statuses: RpcStatus[] = []
  await makeAdapter().getRegions({
    statusCallback: s => {
      statuses.push(s)
    },
  })
  // what an assembly load's spinner shows instead of a bare "Loading", then the
  // '' every phase helper clears with. The phase names the file as well as the
  // work, which is what a load that then stops reporting has to show
  expect(statusMessageText(statuses[0])).toBe('Downloading chromosome sizes')
  expect(statusSource(statuses[0])).toMatch(/volvox\.chrom\.sizes$/)
  expect(statuses.at(-1)).toBe('')
})
