import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

// `color` is a DEFERRED slot: `makeColorEvaluator` in the worker binds `feature`
// and evaluates it once per point, so what `rpcProps()` must carry is the
// expression, not an answer. The model reads it with a plain arg-less
// `getConf`, and that is correct only because a callback read with no context
// is not evaluated (see readConfObject) — evaluated here, on the main thread,
// against no feature, the expression would arrive as a plain string, fail
// `isJexl`, and paint every point one constant color with no error anywhere.
//
// No gwas-side code guards this. That is the point of the test: the guarantee
// lives in the config reader, so this display gets it without knowing about it,
// and so does any other display that curates its own `rpcProps()`. The
// multi-row display's partitionFieldTransport.test.ts is the same canary from
// the other end.
const BY_ATTRIBUTE = "jexl:get(feature,'category')=='hit' ? 'red' : 'grey'"

describe('the color slot reaches the worker unevaluated', () => {
  it('forwards a jexl color as its raw expression string', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'color', BY_ATTRIBUTE)

    expect(display.color).toBe(BY_ATTRIBUTE)
    expect(display.rpcProps().color).toBe(BY_ATTRIBUTE)
  })

  it('leaves a plain CSS color alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'color', 'rebeccapurple')

    expect(display.rpcProps().color).toBe('rebeccapurple')
  })
})
