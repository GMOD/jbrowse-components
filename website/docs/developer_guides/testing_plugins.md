---
title: Testing a plugin
description:
  Unit-testing adapters, models, and components, plus where browser tests fit
guide_category: Advanced topics
---

**TL;DR:** most plugin logic is covered by fast Jest unit tests (adapters,
models) and jsdom render tests (components); browser tests drive the built app.

The plugin templates
([Creating a simple plugin](/docs/developer_guides/simple_plugin)) ship with
Jest preconfigured, so `pnpm test` works out of the box.

## Adapter tests

Construct the adapter from its config schema and read features. Use
`require.resolve` for `localPath` so tests reference bundled test data, and
collect the observable into an array with rxjs before asserting:

```ts
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import MyAdapter from './MyAdapter.ts'
import configSchema from './configSchema.ts'

test('reads features from a region', async () => {
  const adapter = new MyAdapter(
    configSchema.create({
      myLocation: { localPath: require.resolve('../test_data/example.bed') },
    }),
  )
  const features = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  const array = await firstValueFrom(features.pipe(toArray()))
  expect(array.map(f => f.toJSON())).toMatchSnapshot()
})
```

`getFeatures` returns an rxjs `Observable`;
`firstValueFrom(obs.pipe(toArray()))` turns the stream into a promise of an
array. Snapshotting `f.toJSON()` locks feature output.

## Model and session tests

`createTestSession` from `@jbrowse/web/testUtils` builds a full root model with
the core plugins and a main-thread RPC driver, so you can exercise session
actions, views, widgets, and display models without a browser. Mock the worker
factory, since jsdom has no real workers:

```ts
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('adds a view and a track', () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 },
    ],
  })
  expect(view.type).toBe('LinearGenomeView')
})
```

`createTestSession` accepts `sessionSnapshot`, `jbrowseConfig`, `adminMode`, and
preloaded `runtimePlugins`. The returned object is the session model, so
`session.addView`, `addWidget`, `showWidget`, `addTrackConf` are all available.
To test a custom plugin's pluggable elements, add it to the `PluginManager` the
way core plugins are added, or pass it via `runtimePlugins`.

## Component tests

React components render in jsdom with `@testing-library/react`. Build a model
with `createTestSession`, pass it to the component, and assert on the DOM:

```tsx
import { render } from '@testing-library/react'

test('renders the widget', () => {
  const session = createTestSession()
  const widget = session.addWidget('MyWidget', 'myWidget')
  const { getByText } = render(<MyWidgetComponent model={widget} />)
  expect(getByText('Expected label')).toBeTruthy()
})
```

Two jsdom gotchas: `Blob` has no `text()` method (use `FileReader.readAsText`),
and virtualized trees/grids need a mocked measured height to render any rows
(mock `useMeasure` to return a large height).

## Browser (end-to-end) tests

Puppeteer tests in `products/jbrowse-web/browser-tests/` drive the built app and
compare rendered canvases against committed PNGs. Rendering is async, so never
assert on a fixed timeout; wait on a signal:

- `data-testid="loading-overlay"` count reaching `0` means all tracks in a view
  finished loading.
- Per-view `*-done` test-ids (e.g. `synteny_canvas_done`) gate on a display's
  `settled` getter (drawn and not refetching), not a bare "drawn" flag.

Run with `pnpm test:browser` (builds `@jbrowse/web` first) or
`pnpm test:browser:update` to refresh snapshots. See
`agent-docs/reference/TEST_INFRASTRUCTURE.md` for the full harness reference.

## Running tests

- `pnpm test <directory>` - Jest for a subtree (prefer over the full suite while
  iterating).
- `pnpm test:browser` - build and run the Puppeteer suite.

## See also

- [Creating a simple plugin](/docs/developer_guides/simple_plugin)
- [Creating a data adapter](/docs/developer_guides/creating_adapter)
- [Creating a widget](/docs/developer_guides/creating_widget)
