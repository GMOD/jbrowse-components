// MUST be first, and MUST stay a side-effect import: it supplies React's
// render-logging gate, which react-dom reads once at module scope, and the
// import sorter is free to move a named import below the react-dom ones (it
// did, and the test went green having exercised nothing — which is what the
// renderLoggedComponents() assertion at the bottom now catches).
import './enableReactRenderLogging.ts'

// the /pure entry point: no auto-cleanup on afterEach. The failure under test
// throws out of React's commit and leaves the renderer wedged, and RTL's
// teardown unmount then throws "Should not already be working" over the top of
// it, turning a clean assertion failure into an unreadable suite crash.
import { act, renderHook } from '@testing-library/react/pure'
import { when } from 'mobx'

import SessionLoader from '../SessionLoader.ts'
import Renderer from './Renderer.tsx'
import { renderLoggedComponents } from './renderLogRecord.ts'
import { useLoaderLifecycle } from './useLoaderLifecycle.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'
import type { WebRootModel } from '../rootModel/rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

function makeLoader() {
  return SessionLoader.create({
    initialTimestamp: 1,
    configSnapshot: {},
    // hubURL is the model's only array property, and a preset sessionSource
    // means loadSessionByType never consults isHubSession — so nothing reads it
    // and its child node stays UNINITIALIZED, which is what turns the read
    // below from a warning into a throw.
    //
    // Empty, because that is what the app itself always produces and so this
    // is not a hub-only bug: readHubUrlParam returns [] for an absent &hubURL=,
    // createSessionLoaderFromUrl passes that unconditionally, and
    // reloadSessionLoader spreads it into every replacement. An empty array
    // node is an uninitialized child like any other.
    hubURL: [],
    sessionSource: { type: 'snapshot', snapshot: { id: 'a', name: 'a' } },
  })
}

// The reported failure, in one flush.
//
// React's passive-effect flush runs unmount effects and then mount effects. The
// lifecycle effect's cleanup used to destroy the superseded loader in the
// unmount half; a few frames later, in the mount half, React's dev-mode
// logComponentRender diffs each component's props with
// addObjectDiffToProperties, which recurses into the props object and reads
// every property — including the loader it was just handed:
//
//   Object.get [as configPath]
//   addObjectDiffToProperties (react-dom-client.development.js:3967)
//   logComponentRender        (react-dom-client.development.js:4129)
//   commitPassiveMountOnFiber (react-dom-client.development.js:15468)
//
// One liveliness warning per attribute. On an array-typed attribute whose child
// node is still UNINITIALIZED it is not a warning at all but a throw, because
// createObservableInstance asserts the node is INITIALIZING and a dead one is
// not: "the creation of the observable instance must be done on the
// initializing phase".
test('React dev render-logging does not read a destroyed loader', async () => {
  const loader = makeLoader()
  let current: SessionLoaderModel = loader
  const { rerender } = renderHook(
    ({ l }: { l: SessionLoaderModel }) => {
      useLoaderLifecycle(l, next => {
        current = next
      })
      return <Renderer loader={l} />
    },
    { initialProps: { l: loader } },
  )
  await act(async () => {
    await when(() => !!loader.pluginManager)
  })
  const rootModel = loader.pluginManager!.rootModel as WebRootModel

  const warnings: string[] = []
  const origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    const msg = args.map(a => `${a}`).join(' ')
    if (msg.includes("Object type: 'SessionLoader'")) {
      warnings.push(msg)
    } else {
      origWarn(...(args as []))
    }
  }
  let thrown: unknown
  try {
    act(() => {
      rootModel.reloadPluginManagerCallback({}, { id: 'b', name: 'b' })
    })
    // The app renders the replacement. React's own dep-change cleanup detaches
    // the superseded loader in the unmount half of that flush, and its
    // render-logging reads the old props in the mount half of the same one.
    act(() => {
      rerender({ l: current })
    })
    act(() => {
      rerender({ l: current })
    })
  } catch (e) {
    thrown = e
  } finally {
    console.warn = origWarn
  }

  expect(thrown).toBeUndefined()
  expect(warnings).toEqual([])
  // and the mechanism under test actually ran, so the two assertions above
  // cannot pass for the wrong reason (see renderLogRecord).
  //
  // What it logs is renderHook's own wrapper rather than Renderer: its props
  // are the `{l: loader}` this test passes, so it is the component whose diff
  // recurses into the loader. In the browser it was Renderer's own props. The
  // mechanism is the same either way, so this asserts that a props walk
  // happened rather than naming a component RTL owns.
  expect(renderLoggedComponents().length).toBeGreaterThan(0)
})
