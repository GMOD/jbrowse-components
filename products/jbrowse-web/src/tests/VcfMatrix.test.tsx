import { testLinearMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000

// The `regular` and `rphased` cases lived in their own VcfMatrixRegular.test.tsx
// and differed from these two only in the `displayType` argument, so the second
// file bought a second plugin-graph boot and nothing else.

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
