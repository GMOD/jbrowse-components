import { testMultiVariantDisplay } from './testMultiVariantDisplay'
import { setupTest } from './util'

setupTest()

test('regular', async () => {
  await testMultiVariantDisplay({ displayType: 'regular', timeout: 90000 })
}, 90000)

test('rphased', async () => {
  await testMultiVariantDisplay({
    displayType: 'regular',
    phasedMode: 'phased',
    timeout: 90000,
  })
}, 90000)
