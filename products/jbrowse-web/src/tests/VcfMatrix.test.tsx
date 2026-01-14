import { testMultiVariantDisplay } from './testMultiVariantDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000

test(
  'matrix',
  async () => {
    await testMultiVariantDisplay({
      displayType: 'matrix',
      timeout,
    })
  },
  timeout,
)

test(
  'mphased',
  async () => {
    await testMultiVariantDisplay({
      displayType: 'matrix',
      phasedMode: 'phased',
      timeout,
    })
  },
  timeout,
)
