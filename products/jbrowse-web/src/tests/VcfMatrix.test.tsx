import { testMultiVariantDisplay } from './testMultiVariantDisplay'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('matrix', async () => {
  await testMultiVariantDisplay({ displayType: 'matrix', timeout: 40000 })
}, 40000)

test('mphased', async () => {
  await testMultiVariantDisplay({
    displayType: 'matrix',
    phasedMode: 'phased',
    timeout: 40000,
  })
}, 40000)
