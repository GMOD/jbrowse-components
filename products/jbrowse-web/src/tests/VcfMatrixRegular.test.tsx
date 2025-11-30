import { testMultiVariantDisplay } from './testMultiVariantDisplay'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

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
