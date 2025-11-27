import { testMultiVariantDisplay } from './renderingUtils'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('regular', async () => {
  await testMultiVariantDisplay({ displayType: 'regular' })
}, 60000)

test('rphased', async () => {
  await testMultiVariantDisplay({
    displayType: 'regular',
    phasedMode: 'phased',
  })
}, 60000)
