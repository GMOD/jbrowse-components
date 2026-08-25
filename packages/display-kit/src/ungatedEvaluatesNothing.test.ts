import RegionTooLargeMixin from './RegionTooLargeMixin.ts'

// "Nothing below the opt-in is evaluated" is the property the ungated composers
// (wiggle, Manhattan, sequence, GC content) and the simplified test models rely
// on, and the mixin states it four times in its own comments. What it prevents
// is a throw, not a slow read: `byteGateAdapterConfig` reaches
// `getContainingTrack`, which throws 'no containing track found' for a host that
// has none — so a trackless host is what exercises the invariant.
//
// `gateViewport` is stubbed so the only unguarded walk left is the track one;
// the view read below it is the gate's other reach out of the display and is
// not what these cover.

const VIEWPORT = { key: 'chr1:0-100', spanBp: 100 }

function tracklessHost() {
  return RegionTooLargeMixin()
    .views(() => ({
      get gateViewport() {
        return VIEWPORT
      },
    }))
    .create()
}

function countingHost(gateEnabled: boolean) {
  let evaluations = 0
  const display = RegionTooLargeMixin()
    .views(() => ({
      get gateEnabled() {
        return gateEnabled
      },
      get byteGateAdapterConfig() {
        evaluations += 1
        return { type: 'StubAdapter' }
      },
    }))
    .create()
  return { display, countEvaluations: () => evaluations }
}

describe('an ungated display never reaches its containing track', () => {
  it('captures a fetch state with no containing track', () => {
    const display = tracklessHost()
    expect(() => display.gateFetchState()).not.toThrow()
    expect(display.gateFetchState().tierKey).toBeUndefined()
  })

  it('commits a fetch with no containing track', () => {
    const display = tracklessHost()
    expect(() => {
      display.commitFetchBytes([500], {
        viewport: VIEWPORT,
        gated: false,
        tierKey: undefined,
      })
    }).not.toThrow()
    expect(display.byteEstimate).toBeUndefined()
  })
})

describe('the adapter key is read exactly where the gate needs it', () => {
  it('is not evaluated by a commit while the gate is off', () => {
    const { display, countEvaluations } = countingHost(false)
    const before = countEvaluations()
    display.commitFetchBytes([500], {
      viewport: VIEWPORT,
      gated: false,
      tierKey: undefined,
    })
    expect(countEvaluations() - before).toBe(0)
  })

  it('is evaluated by a commit while the gate is on', () => {
    const { display, countEvaluations } = countingHost(true)
    const before = countEvaluations()
    display.commitFetchBytes([500], {
      viewport: VIEWPORT,
      gated: true,
      tierKey: display.byteGateAdapterKey,
    })
    expect(countEvaluations() - before).toBeGreaterThan(0)
    expect(display.byteEstimate?.bytes).toBe(500)
  })
})
