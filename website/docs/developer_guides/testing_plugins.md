---
title: Testing a plugin
description:
  Unit-testing adapters, models, and components, plus where browser tests fit
guide_category: Advanced topics
---

**TL;DR:** most plugin logic is covered by fast Jest unit tests (adapters,
models) and jsdom render tests (components); browser tests drive the built app.

The [plugin templates](/docs/developer_guides/simple_plugin) ship with Jest
preconfigured, so `pnpm test` works out of the box.

## Adapter tests

Construct the adapter from its config schema and read features. `Gff3Adapter`'s
own test, in full:

<!-- include: plugins/gff3/src/Gff3Adapter/Gff3Adapter.test.ts -->

```ts
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Gff3Adapter from './Gff3Adapter.ts'
import configSchema from './configSchema.ts'

describe('adapter can fetch features from volvox.gff3', () => {
  let adapter: Gff3Adapter
  beforeEach(() => {
    adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('../test_data/volvox.sort.gff3'),
        },
      }),
    )
  })
  it('test getfeatures on gff plain text adapter', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgB',
      start: 0,
      end: 200000,
    })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(true)
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    // There are only 4 features in ctgB
    expect(featuresArray.length).toBe(4)
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray).toMatchSnapshot()
  })
})

describe('discontinuous feature parsing', () => {
  it('keeps every segment of a CDS that shares one ID across lines', async () => {
    const adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('../test_data/disjoint_cds.gff3'),
        },
      }),
    )
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 1000,
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    const gene = featuresArray[0]!.toJSON()
    const mrna = gene.subfeatures![0]!
    const cds = mrna.subfeatures!.filter(f => f.type === 'CDS')
    expect(cds.length).toBe(3)
    expect(cds.map(f => f.start)).toEqual([0, 199, 399])
  })
})
```

`require.resolve` for `localPath` keeps the path relative to the test file
rather than the working directory. `getFeatures` returns an rxjs `Observable`,
so `firstValueFrom(obs.pipe(toArray()))` turns the stream into a promise of an
array. Snapshot `f.toJSON()` to lock the whole shape; assert on specific fields
when the point of the test is one of them, as the second block does.

## Model and session tests

`createTestSession` from `@jbrowse/web/testUtils` builds a full root model with
the core plugins and a main-thread RPC driver, so you can exercise session
actions, views, widgets, and display models without a browser. Mock the worker
factory, since jsdom has no real workers:

<!-- include: plugins/data-management/src/AddTrackWidget/wrongAssembly.test.tsx -->

```tsx
import { createTestSession } from '@jbrowse/web/testUtils'

import { doSubmit } from './components/doSubmit.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addAsm(session: ReturnType<typeof createTestSession>, name: string) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `ref-${name}`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctg',
            uniqueId: name,
            start: 0,
            end: 10,
            seq: 'acgtacgtac',
          },
        ],
      },
    },
  })
}

test('adding a track for an assembly not open in the view notifies the user', () => {
  const session = createTestSession()
  addAsm(session, 'asmA')
  addAsm(session, 'asmB')

  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'asmA', refName: 'ctg', start: 0, end: 10 },
    ],
  })

  const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  widget.setTrackData({ uri: 'foo.bam', locationType: 'UriLocation' })
  widget.setAssembly('asmB')

  doSubmit({ model: widget })

  // track is still added to the session...
  expect(session.tracks.some(t => t.assemblyNames?.[0] === 'asmB')).toBe(true)
  // ...but not shown in the asmA view, and the user is told why
  expect(view.tracks.length).toBe(0)
  expect(
    session.snackbarMessages.some(
      m => m.level === 'warning' && m.message.includes('asmB'),
    ),
  ).toBe(true)
})
```

`createTestSession` accepts `sessionSnapshot`, `jbrowseConfig`, `adminMode`, and
preloaded `runtimePlugins`, and returns the session model, so `addView`,
`addWidget`, `showWidget`, and `addSessionTrackConf` are all available. To test
a custom plugin's pluggable elements, pass it via `runtimePlugins`.

**A view you add afterwards has no width, and `view.width` throws.** There is no
layout in jsdom, so nothing sizes a view on its own: `createTestSession` sets
800px on the views your `sessionSnapshot` declares, and only those. A view from
a later `session.addView(...)` is unsized, and the getter throws
`width undefined, make sure to check for model.initialized` the moment anything
reads it — which most block and coordinate logic does. Either declare the view
in the snapshot, as the component test below does, or call `view.setWidth(800)`
straight after adding it, which is what the integration tests across the repo
do.

`FromConfigSequenceAdapter` is what keeps a session test off the network: the
assembly's sequence is inline, so nothing is fetched and the assembly is ready
immediately.

## Component tests

React components render in jsdom with `@testing-library/react`. Build a model
with `createTestSession`, pass it to the component, and assert on the DOM:

<!-- include: plugins/grid-bookmark/src/GridBookmarkWidget/components/GridBookmarkWidget.test.tsx -->

```tsx
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import GridBookmarkWidget from './GridBookmarkWidget.tsx'

import type { GridBookmarkModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const theme = createJBrowseTheme()

function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          bpPerPx: 1,
          offsetPx: 0,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          ],
        },
      ],
    },
  })
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  return widget
}

function renderWidget(widget: GridBookmarkModel) {
  return render(
    <ThemeProvider theme={theme}>
      <GridBookmarkWidget model={widget} />
    </ThemeProvider>,
  )
}

test('single grid renders for bookmarks/highlights, two for both', () => {
  const widget = setup()

  widget.setGridView('bookmarks')
  const { container, rerender } = renderWidget(widget)
  expect(container.querySelectorAll('.MuiDataGrid-root')).toHaveLength(1)

  widget.setGridView('both')
  rerender(
    <ThemeProvider theme={theme}>
      <GridBookmarkWidget model={widget} />
    </ThemeProvider>,
  )
  expect(container.querySelectorAll('.MuiDataGrid-root')).toHaveLength(2)
})
```

Wrap in a `ThemeProvider` built by `createJBrowseTheme` as that does: JBrowse
components read the JBrowse theme, not MUI's default.

Two jsdom gotchas:

- `Blob` has no `text()` method — use `FileReader.readAsText`.
- Virtualized trees/grids need a mocked measured height to render any rows —
  mock `useMeasure` to return a large height.

## Browser (end-to-end) tests

Puppeteer tests in `products/jbrowse-web/browser-tests/` drive the built app and
compare rendered canvases against committed PNGs. Rendering is async, so never
assert on a fixed timeout; wait on a signal:

- `data-testid="loading-overlay"` count reaching `0` means all tracks in a view
  finished loading.
- The `data-display-drawn` attribute (e.g. on `synteny_canvas`) gates on a
  display's `settled` getter: drawn and not refetching.

Run with `pnpm test:browser` (builds `@jbrowse/web` first) or
`pnpm test:browser:update` to refresh snapshots. See
`agent-docs/reference/TEST_INFRASTRUCTURE.md` for the full harness reference.

## Running tests

- `pnpm test <directory>` - Jest for a subtree (prefer over the full suite while
  iterating).
- `pnpm test:browser` - build and run the Puppeteer suite.

## See also

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/creating_widget)
