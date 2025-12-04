import { testMultiVariantDisplay } from './testMultiVariantDisplay'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

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
