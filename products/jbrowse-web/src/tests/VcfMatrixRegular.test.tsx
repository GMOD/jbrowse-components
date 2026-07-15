import { testLinearMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000
test(
  'regular',
  async () => {
    await testLinearMultiSampleVariantDisplay({
      displayType: 'regular',
      timeout,
    })
  },
  timeout,
)

test(
  'rphased',
  async () => {
    await testLinearMultiSampleVariantDisplay({
      displayType: 'regular',
      phasedMode: 'phased',
      timeout,
    })
  },
  timeout,
)
