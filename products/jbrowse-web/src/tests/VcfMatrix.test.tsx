import { testMultiVariantDisplay } from './testMultiVariantDisplay'
import { setupTest } from './util'

setupTest()

test('matrix', async () => {
  await testMultiVariantDisplay({ displayType: 'matrix', timeout: 90000 })
}, 90000)

test('mphased', async () => {
  await testMultiVariantDisplay({
    displayType: 'matrix',
    phasedMode: 'phased',
    timeout: 90000,
  })
}, 90000)
