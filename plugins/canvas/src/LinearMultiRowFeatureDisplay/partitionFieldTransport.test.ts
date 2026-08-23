import { createTestEnvironment } from './testEnv.ts'

// The `partitionField` slot is a DEFERRED expression: the worker binds `feature`
// and evaluates it once per feature (makeFeaturePartitionResolver). So the model
// getter that feeds `rpcProps()` must hand the worker the raw slot string, the
// same way `colorConfig` does — reading it through a resolving reader evaluates
// the callback here, on the main thread, with no feature in scope.
//
// That is what these tests pin. Read through `readConfObject` the rmsk
// expression resolved to '' (jexl's `feature` is undefined, `feature.name`
// undefined, the total `split` coerces it to ''), and '' shipped to the worker
// as an attribute name — so every feature answered `feature.get('')` =>
// undefined => one unnamed row. Before `split` was made total the same read
// threw a TypeError out of a config getter instead, which banners the display.
// Both symptoms, one cause.
const RMSK = "jexl:split(split(feature.name,'#')[1],'/')[0]"

describe('partitionField reaches the worker unevaluated', () => {
  it('forwards a jexl slot as its raw expression string', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: RMSK },
    })
    const { display } = createDisplay()

    expect(display.partitionField).toBe(RMSK)
    expect(display.rpcProps().partitionField).toBe(RMSK)
  })

  it('leaves a plain attribute name alone', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: 'sample' },
    })
    const { display } = createDisplay()

    expect(display.rpcProps().partitionField).toBe('sample')
  })

  // The unset slot is the AUTO sentinel, and auto is resolved in the worker off
  // the columns the file turns out to carry (resolvePartitionField). Sending the
  // main thread's guess instead — 'name', which is what auto falls back to —
  // would make the repClass pick unreachable: the worker cannot tell a guess
  // from a choice.
  it('forwards the unset slot as the empty auto sentinel', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.rpcProps().partitionField).toBe('')
  })
})
