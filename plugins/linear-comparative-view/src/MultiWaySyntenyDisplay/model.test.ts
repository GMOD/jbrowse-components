import { createDisplay } from './testEnv.ts'

// The lane genes and lane links are a SECOND fetch, dependent on the ortholog
// fetch that draws the placement boxes. What that costs the display is three
// rules, and each of these is one of them going wrong before it was written
// down.

// A dependent fetch that holds `displayPhase` at `loading` for every refetch
// puts the striped scrim over lanes that are already drawn: the fetch is
// debounced 500ms and the overlay's anti-flash delay is 250ms, so the scrim
// always won that race on any pan that moved a quantized lane window. Before
// the first commit there is nothing on screen to flash over and a capture
// would shoot placement boxes, which is what the gate is for.
test('the lane fetch is part of loading only until it first lands', () => {
  const display = createDisplay()
  const { key } = display.laneGenesFetchSpecs
  expect(key).not.toBe('')
  expect(display.displayPhase).toBe('loading')

  display.setLaneGenes(key, new Map())
  expect(display.displayPhase).toBe('ready')

  // the pan: the specs move off the committed key, so the lanes are stale and
  // a refetch is due — but they are drawn, and the phase says so
  display.setLaneGenes('a-key-the-specs-have-moved-off', new Map())
  expect(display.laneGenesCurrent).toBe(false)
  expect(display.displayPhase).toBe('ready')
})

// `laneGenesKey` is the dependent fetch's gate: `prepare` declines while the
// committed key answers the current specs. A gate on a freshness signal that
// `reload()` does not invalidate is a dead Retry button — the counter bump
// re-runs the body straight into the decline. A lane whose annotation failed
// commits an empty map, so without this it degraded to placement boxes and no
// Retry could ever ask for that lane again.
test('a reload reopens both dependent fetches, not just the ortholog one', () => {
  const display = createDisplay()
  display.setLaneGenes('genes-key', new Map())
  display.setLaneLinks('links-key', new Map())

  display.reload()

  expect(display.laneGenesKey).toBe('')
  expect(display.laneLinksKey).toBe('')
  // the mixin's own half still happens: its gate is the loaded signature
  expect(display.dataCurrent).toBe(false)
})

// This display's `trackMenuItems` REPLACED the inherited list rather than
// appending to it. Nothing is lost by that today — `BaseDisplay` returns `[]`
// and neither mixin in the chain contributes a row — so this pins the item
// itself and the composition is hygiene against the chain growing one, which
// `addMenuItems` calls out as the silent half of writing an override by hand.
test('the stacked-synteny launcher is on the track menu, over the inherited rows', () => {
  const display = createDisplay()
  const items = display.trackMenuItems()

  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Launch stacked synteny view (visible region)',
  ])
})
