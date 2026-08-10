import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

// `color` is a DEFERRED slot: `makeColorEvaluator` in the worker binds `feature`
// and evaluates it once per point, so what `rpcProps()` must carry is the
// expression, not an answer. The model getter therefore reads the raw slot
// (`self.conf.color`), the same way `LinearBasicDisplay` reads `featureColor`
// and the multi-row display reads `colorConfig`.
//
// It used to read `getConf(self, 'color')`, which evaluates the callback here,
// on the main thread, with no feature in scope: `get(feature,'category')` threw
// `reading 'get'` straight out of this getter and bannered the display. The
// silent spelling of the same mistake is pinned by the multi-row display's
// partitionFieldTransport.test.ts — same cause, no resemblance from outside.
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
