// The per-region family's half of the retry contract check
// (`makeRetryContractCheck`, installed from `MultiRegionDisplayMixin`).
//
// It lives here rather than beside the mixin because the thing under test is
// the wiring between a real `reload()`, the real FetchVisibleRegions autorun and
// a real `fetchNeeded` — and `MultiRegionDisplayMixin` has no standalone
// harness, while Manhattan is the thinnest real display in the family: one
// `fetchEachRegion` call and no second fetch trigger of its own.
//
// What the check reports is the dead Retry button: `reload()` clears the error,
// the autorun re-runs, and nothing refetches. `DisplayErrorBar`'s only action is
// `model.reload()`, so a display in that shape shows a live-looking button that
// does nothing. The global family has had this since arc shipped exactly that
// bug; this family had nothing until now, and its own source comment
// ("a new early return in a `fetchNeeded` override has to satisfy that or the
// display wedges") was the only thing watching.
//
// Reports arrive through `console.error`, and `config/jest/console.js` fails any
// test that leaves one unclaimed, so every test here takes them.

import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchemaFactory.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type { LinearManhattanDisplayModel } from './stateModelFactory.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const REGIONS = ['ctgA', 'ctgB'].map(refName => ({
  refName,
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}))

// The real display plus the three levers the check reads. Composed rather than
// stubbed so everything under test — `reload()`, the autorun's trigger reads,
// `fetchNeeded` reaching `fetchRegions` — is the production code path.
//
// `bumpReloadCounterOnly` is the arc bug written into this family: the counter
// moves and nothing is invalidated, so the autorun re-runs (which is what the
// unconditional `reloadCounter` read buys) and then finds every block covered.
function testStateModel(pm: PluginManager, schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'RetryContractTestDisplay',
      stateModelFactory(pm, schema),
      types.model({}),
    )
    .volatile(() => ({
      suppressed: false,
      prereqPending: false,
    }))
    .views(self => ({
      get loadingSuppressed() {
        return self.suppressed
      },
      get awaitingPrerequisite() {
        return self.prereqPending
      },
    }))
    .actions(self => ({
      setSuppressed(flag: boolean) {
        self.suppressed = flag
      },
      setPrereqPending(flag: boolean) {
        self.prereqPending = flag
      },
      bumpReloadCounterOnly() {
        self.reloadCounter++
      },
    }))
}

type TestDisplay = LinearManhattanDisplayModel & {
  reloadCounter: number
  setSuppressed: (flag: boolean) => void
  setPrereqPending: (flag: boolean) => void
  bumpReloadCounterOnly: () => void
}

function setup() {
  const env = createDisplayTestEnvironment<TestDisplay>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'GWASTrack',
    adapter: {
      name: 'GWASAdapter',
      slots: { ldAdapter: { type: 'frozen', defaultValue: null } },
      config: {
        type: 'GWASAdapter',
        ldAdapter: { type: 'PlinkLDAdapter', uri: 'https://example.com/x.ld' },
      },
    },
    displayName: 'LinearManhattanDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: testStateModel,
    viewModel: linearGenomeViewStateModelFactory,
    regions: REGIONS,
    onViewReady: view => {
      view.showAllRegions()
    },
  })
  env.mockRpcCall.mockResolvedValue([])
  return env
}

// The FetchVisibleRegions autorun carries `delay: 600`, so every run after the
// first needs the debounce waited out rather than a microtask.
//
// `unref` where there is one, so the longest timers in this file can't hold
// jest's worker open past the run. Optional because there isn't one under jsdom,
// where `setTimeout` returns a number — the lint rule reads node's types and
// calls the guard unnecessary, and it is the guard that keeps this from throwing
// under the environment the suite actually runs in.
function settle() {
  return new Promise(resolve => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- jsdom's setTimeout returns a number
    setTimeout(resolve, 800).unref?.()
  })
}

// The first fetch cycle has to be fully over before a test provokes anything:
// a fetch settling late bumps `fetchGeneration` and re-runs the autorun on its
// own, and a test would then pass on that run rather than on the one its own
// action provoked. That is not hypothetical — with a fixed wait here, deleting
// the autorun's `reloadCounter` read left this file green.
//
// Adaptive rather than a fixed sleep, because a fixed one long enough for a
// loaded CI worker is also long enough to blow jest's 5s default on every test.
// Quiet means no fetch in flight and no new RPC across a full debounce window.
async function quiesce(
  display: TestDisplay,
  mockRpcCall: { mock: { calls: unknown[] } },
) {
  for (let i = 0; i < 12; i++) {
    const before = mockRpcCall.mock.calls.length
    await settle()
    if (!display.isLoading && mockRpcCall.mock.calls.length === before) {
      return
    }
  }
  throw new Error('display never went quiet')
}

// Jest's 5s default is not a budget these can live inside: one quiesce plus one
// provoked run is several debounce windows, and on a machine running other
// suites in parallel it is more. A too-tight limit here fails as six red tests
// that look like the check misbehaving, which is what it did before this line.
jest.setTimeout(60_000)

const reports = () => takeDisplayContractReports()

test('a healthy reload refetches, and the check says nothing', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display } = createDisplay()
  await quiesce(display, mockRpcCall)

  const before = mockRpcCall.mock.calls.length
  expect(before).toBeGreaterThan(0)

  display.reload()
  await settle()

  expect(mockRpcCall.mock.calls.length).toBeGreaterThan(before)
  expect(reports()).toEqual([])
})

// The shape the check exists for.
test('a reload that invalidates nothing is reported as a dead button', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display } = createDisplay()
  await quiesce(display, mockRpcCall)

  const before = mockRpcCall.mock.calls.length
  display.bumpReloadCounterOnly()
  await settle()

  expect(mockRpcCall.mock.calls.length).toBe(before)
  expect(reports().join('\n')).toMatch(/Retry is a dead button/)
})

// The message is the whole value of the check — a bare "contract violated" would
// cost the same hours the failure already costs. Assert it names the fix.
test('the report names the fix, not just the symptom', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display } = createDisplay()
  await quiesce(display, mockRpcCall)

  display.bumpReloadCounterOnly()
  await settle()

  const message = reports().join('\n')
  expect(message).toMatch(/reload\(\) has to invalidate/)
  expect(message).toMatch(/loadingSuppressed/)
  expect(message).toMatch(/awaitingPrerequisite/)
})

// A pan or a settings change that finds everything covered is not a retry. The
// counter is the only thing separating them, so a decline with no bump behind it
// must stay silent.
test('says nothing about a decline with no reload behind it', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display, view } = createDisplay()
  await quiesce(display, mockRpcCall)

  // zoom in, so every visible block stays inside what is already loaded
  view.zoomTo(view.bpPerPx / 2)
  await settle()

  expect(reports()).toEqual([])
})

// `loadingSuppressed` is the one outright exemption: a display deliberately not
// fetching at all has a `reload()` that correctly does nothing. Sequence reaches
// it through `zoomedOut`, which its `placeholderMessage` implies.
test('a display that says it is not fetching is exempt', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display } = createDisplay()
  await quiesce(display, mockRpcCall)

  display.setSuppressed(true)
  display.bumpReloadCounterOnly()
  await settle()

  expect(reports()).toEqual([])
})

// The deferral, which is the half that keeps the check honest: a display may say
// "this decline is preliminary" and the bump stays OUTSTANDING rather than being
// consumed, so the run after the prerequisite lands is the one judged. Declining
// again once it has landed still reports — an exemption would have let the
// display spend its retry on the preliminary decline.
//
// **One bump, deliberately.** Bumping a second time would pass under an
// exemption too — the second bump is its own unanswered retry — so the run that
// has to report is one with no new bump behind it, reached by a zoom that leaves
// every block covered. That is the difference an exemption would erase: it
// consumes the bump on the preliminary decline, and nothing is left to report.
test('a claimed prerequisite defers the verdict rather than waiving it', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display, view } = createDisplay()
  await quiesce(display, mockRpcCall)

  display.setPrereqPending(true)
  display.bumpReloadCounterOnly()
  await settle()
  expect(reports()).toEqual([])

  // prerequisite in hand; the next run to reach the check answers the retry,
  // and it declines, because zooming in leaves the loaded blocks covering the
  // viewport
  display.setPrereqPending(false)
  view.zoomTo(view.bpPerPx / 2)
  await settle()
  expect(reports().join('\n')).toMatch(/Retry is a dead button/)
})
