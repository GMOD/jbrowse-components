import { testLinearMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000

test(
  'matrix',
  async () => {
    await testLinearMultiSampleVariantDisplay({
      displayType: 'matrix',
      timeout,
    })
  },
  timeout,
)

test(
  'mphased',
  async () => {
    await testLinearMultiSampleVariantDisplay({
      displayType: 'matrix',
      phasedMode: 'phased',
      timeout,
    })
  },
  timeout,
)
