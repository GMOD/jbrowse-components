import { testMultiVariantDisplay } from './testMultiVariantDisplay'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000
test(
  'regular',
  async () => {
    await testMultiVariantDisplay({
      displayType: 'regular',
      timeout,
    })
  },
  timeout,
)

test(
  'rphased',
  async () => {
    await testMultiVariantDisplay({
      displayType: 'regular',
      phasedMode: 'phased',
      timeout,
    })
  },
  timeout,
)
