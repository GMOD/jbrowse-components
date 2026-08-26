import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import {
  BaseDisplay,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import { act, render, waitFor, within } from '@testing-library/react'
import { observer } from 'mobx-react'

import { stateModelFactory } from '../index.ts'
import volvoxDisplayedRegions from '../volvoxDisplayedRegions.json' with { type: 'json' }
import { useViewSvgFigure } from './useViewSvgFigure.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

// A stub session and two display types — one that can render SVG and one that
// cannot — which is the whole of what a figure reads. Deliberately not the
// harness in `../index.test.ts`: that one's display has no `renderSvg`, and
// having both kinds here is what lets the skipped-track case be a test rather
// than a claim.

const DISPLAY_HEIGHT = 40
const VIEW_WIDTH = 800

function displayModel(
  name: string,
  configSchema: AnyConfigurationSchemaType,
  canRenderSvg: boolean,
) {
  const base = types.compose(
    name,
    types.compose(BaseDisplay, TrackHeightMixin()),
    types.model({
      type: types.literal(name),
      configuration: ConfigurationReference(configSchema),
    }),
  )
  return canRenderSvg
    ? base.actions(() => ({
        // the shape every real display's renderSvg has: async, resolving to a
        // ReactNode drawn in the track body's own coordinate space
        async renderSvg() {
          return <rect data-testid="body" width={10} height={10} />
        },
      }))
    : base
}

function initialize() {
  const stubManager = new PluginManager()
  // before the display types, so the registry links them to it
  stubManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearGenomeView',
        stateModel: stateModelFactory(stubManager),
        ReactComponent: () => null,
      }),
  )
  for (const [trackType, displayType, canRenderSvg] of [
    ['SvgTrack', 'LinearSvgDisplay', true],
    ['PlainTrack', 'LinearPlainDisplay', false],
  ] as const) {
    stubManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        trackType,
        {},
        {
          baseConfiguration: createBaseTrackConfig(stubManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: trackType,
        configSchema,
        stateModel: createBaseTrackModel(stubManager, trackType, configSchema),
      })
    })
    stubManager.addDisplayType(() => {
      const configSchema = ConfigurationSchema(
        displayType,
        { height: { type: 'number', defaultValue: DISPLAY_HEIGHT } },
        { explicitIdentifier: 'displayId', explicitlyTyped: true },
      )
      return new DisplayType({
        name: displayType,
        configSchema,
        stateModel: displayModel(displayType, configSchema, canRenderSvg),
        trackType,
        viewType: 'LinearGenomeView',
        ReactComponent: () => null,
      })
    })
  }
  stubManager.createPluggableElements()
  stubManager.configure()

  const Assembly = types
    .model({ name: types.maybe(types.string) })
    .volatile(() => ({
      regions: volvoxDisplayedRegions,
      initialized: true,
      statusMessage: undefined as string | undefined,
      statusProgress: undefined as number | undefined,
    }))
    .views(() => ({
      getCanonicalRefName(refName: string) {
        return refName
      },
      getCanonicalRefName2(refName: string) {
        return refName
      },
    }))
    .actions(() => ({
      async load() {},
      setStatus() {},
    }))
  const AssemblyManager = types
    .model({ assemblies: types.map(Assembly) })
    .views(self => ({
      get assemblyNameMap() {
        return Object.fromEntries(self.assemblies.entries())
      },
      get(name: string) {
        return self.assemblies.get(name)
      },
      isValidRefName(str: string) {
        return str === 'ctgA' || str === 'ctgB'
      },
      loadingAssembly() {
        return undefined
      },
      async waitForAssembly(name: string) {
        return self.assemblies.get(name)
      },
    }))
  const LinearGenomeModel =
    stubManager.getViewType('LinearGenomeView').stateModel
  const Session = types
    .model({
      name: 'svgFigureSession',
      rpcManager: 'rpcManagerExists',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
      // real track configs, because a shown track holds a *reference* to one:
      // `showTrack` resolves the id through the session and stores the
      // identifier, so a stub that answered with a plain object would leave
      // every track's `configuration` unresolvable
      tracks: types.array(stubManager.pluggableConfigSchemaType('track')),
      highlightsVisible: types.optional(types.boolean, true),
      assemblyManager: types.optional(AssemblyManager, {
        assemblies: { volvox: { name: 'volvox' } },
      }),
    })
    .views(self => ({
      get views() {
        return self.view ? [self.view] : []
      },
      // only read for an unnamed ReferenceSequenceTrack, which these are not
      get assemblies() {
        return []
      },
      getDisplayTypeDefault() {
        return undefined
      },
      getTrackById(trackId: string) {
        return self.tracks.find(track => track.trackId === trackId)
      },
    }))
    .actions(self => ({
      setView(view: LinearGenomeViewModel) {
        self.view = view
        return view
      },
      notifyError(message: string) {
        console.error(message)
      },
      // HighlightsMixin's afterAttach reveals the bands whenever the collection
      // grows, so a view carrying a highlight needs this to exist
      revealHighlights() {},
    }))
  return { Session, LinearGenomeModel, stubManager }
}

function makeView(tracks: { trackId: string; name: string; type: string }[]) {
  const { Session, LinearGenomeModel, stubManager } = initialize()
  // the env carries the plugin manager, which the highlight layer reaches for
  // through `getEnv` to fold in whatever plugins contribute to a figure
  const view = Session.create(
    { configuration: {}, tracks },
    { pluginManager: stubManager },
  ).setView(
    LinearGenomeModel.create({
      id: 'svgFigureView',
      type: 'LinearGenomeView',
    }),
  )
  view.setWidth(VIEW_WIDTH)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
  ])
  for (const track of tracks) {
    view.showTrack(track.trackId)
  }
  // Flushed rather than waited out: the coarse blocks a figure keys off are
  // written by a 500ms-delayed autorun, so a test that let it fire would be
  // asserting against whichever side of that window it landed on.
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  return view
}

// A host of the shape the examples site's page has: an observer that reads the
// live view (a position readout) *and* holds the figure. The pairing is the
// point — see the freeze test.
const Host = observer(function Host({ view }: { view: LinearGenomeViewModel }) {
  const { figure, width, height, skipped, isLoading } = useViewSvgFigure(view)
  return (
    <div>
      <span data-testid="offset">{Math.round(view.offsetPx)}</span>
      <span data-testid="size">{`${width}x${height}`}</span>
      <span data-testid="skipped">{skipped.join(',')}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      {figure}
    </div>
  )
})

// Queries scoped to this render's own container, not to the document: two
// figures live side by side in the skipped-track test below.
//
// `within` rather than an interpolated `[data-testid="..."]` selector, which is
// not a style preference: `unicorn/require-css-escape` autofixes one of those
// into `CSS.escape(testid)`, and jsdom implements no `CSS` object at all, so the
// helper throws a ReferenceError and takes every test in the file with it. The
// pre-push hook lands its own `lint --fix`, so a disable comment is the only
// other thing that holds — several elsewhere in the repo do exactly that.
async function renderFigure(view: LinearGenomeViewModel) {
  const { container } = render(<Host view={view} />)
  await waitFor(() => {
    expect(container.querySelector('svg')).toBeTruthy()
  })
  return {
    container,
    svg: () => container.querySelector('svg')!,
    text: (testid: string) => within(container).getByTestId(testid).textContent,
  }
}

test('draws the tracks, the header and the ruler at the reserved size', async () => {
  const view = makeView([{ trackId: 'first', name: 'first', type: 'SvgTrack' }])
  const { svg: getSvg, text } = await renderFigure(view)

  const svg = getSvg()
  // the display's own body, from its renderSvg
  expect(svg.querySelector('[data-testid="body"]')).toBeTruthy()
  // the row header: assembly name, and the ruler's refName label
  expect(svg.textContent).toContain('volvox')
  expect(svg.textContent).toContain('ctgA')

  // width is the view plus both gutters — a figure narrower than
  // `view.width + margin * 2` is one whose wiggle y-axis is clipped
  const width = Number(svg.getAttribute('width'))
  expect(width).toBe(VIEW_WIDTH + 100)
  // and the box the hook reports is the box it drew, which is what a host
  // reserves space with
  expect(text('size')).toBe(`${width}x${svg.getAttribute('height')}`)
})

// A figure's track bodies are frozen at a moment in the past, while SVGView and
// SVGRowHeader re-derive the ruler, the scalebar and the seams from the live
// model on any render they get, so a host re-rendering for its own reasons —
// this one draws a position readout, as every example does — must not advance
// one half past the other.
//
// **Under `pnpm test` this cannot fail, and the run that makes it mean
// something is `pnpm test-ci-no-react-compiler`.** Two things hold the figure
// still: the `memo` in `useViewSvgFigure`, and React Compiler, which
// `babel.config.cjs` runs over every component here. Delete the `memo` and this
// still passes compiled; delete it under `NO_RC=1` and it fails with the ruler
// ticks at 62 while the track body stays at the snapshot's 199 — the two clocks.
// A consumer gets `build:esm`'s plain tsc output with no compiler pass, so the
// uncompiled run is the one that describes them.
//
// `'use no memo'` is not a substitute for that switch. The compiler memoizes the
// whole chrome chain (`SVGRuler.tsx` alone compiles to caches in `Ruler`,
// `SVGRefNameLabels`, `SVGRefNameLabel` and `SVGRuler`), so opting out one
// function just moves the absorption one level down and this test stays green.
test('the drawn figure does not move when the host re-renders', async () => {
  const view = makeView([{ trackId: 'first', name: 'first', type: 'SvgTrack' }])
  const { svg, text } = await renderFigure(view)
  const before = svg().innerHTML
  const offsetBefore = view.offsetPx

  // `await act`, not a bare one: the re-render a mobx write provokes here is
  // scheduled rather than synchronous, and asserting before it lands passes for
  // no reason at all
  await act(async () => {
    view.scrollTo(view.offsetPx + 137)
    await Promise.resolve()
  })

  // the view really moved, and the host really did re-render against it...
  expect(view.offsetPx).toBe(offsetBefore + 137)
  expect(text('offset')).toBe(String(view.offsetPx))
  // ...and the figure did not, so its ruler still describes its own bodies
  expect(svg().innerHTML).toBe(before)
})

// The `memo` above holds the figure still against a *parent* render, and that is
// all it holds: an `observer` inside the frozen tree re-renders itself on its own
// subscription, which no amount of memoization upstream can stop. The highlight
// layer was one, so the bands panned across track bodies drawn where the
// snapshot left them — the two clocks again, arriving by the one door the memo
// does not cover. Unlike the test above this one fails compiled too, so it is
// the run-agnostic half of the same rule.
test('a highlight band does not move when the view pans', async () => {
  const view = makeView([{ trackId: 'first', name: 'first', type: 'SvgTrack' }])
  view.setHighlight([
    { assemblyName: 'volvox', refName: 'ctgA', start: 1000, end: 2000 },
  ])
  const { svg } = await renderFigure(view)
  // the band is really drawn, or this passes by drawing nothing
  const band = () => svg().querySelector('[fill-opacity]')?.getAttribute('x')
  expect(band()).toBeTruthy()
  const before = band()

  await act(async () => {
    view.scrollTo(view.offsetPx + 137)
    await Promise.resolve()
  })

  expect(band()).toBe(before)
})

// The other half of freezing the highlight layer: frozen and stale is no better
// than live and misaligned, so a band added under a drawn figure has to make it
// a new figure. It is in `figureKey` for that, and a highlight is the one thing
// in a figure a reader adds without navigating anywhere.
test('adding a highlight redraws the figure', async () => {
  const view = makeView([{ trackId: 'first', name: 'first', type: 'SvgTrack' }])
  const { svg } = await renderFigure(view)
  const band = () => svg().querySelector('[fill-opacity]')
  expect(band()).toBeNull()

  await act(async () => {
    view.setHighlight([
      { assemblyName: 'volvox', refName: 'ctgA', start: 1000, end: 2000 },
    ])
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(band()).toBeTruthy()
  })
})

test('a display with no renderSvg is named, not drawn, and reserves no height', async () => {
  const both = await renderFigure(
    makeView([
      { trackId: 'first', name: 'first', type: 'SvgTrack' },
      { trackId: 'second', name: 'second', type: 'PlainTrack' },
    ]),
  )
  expect(both.text('skipped')).toBe('second')

  const alone = await renderFigure(
    makeView([{ trackId: 'first', name: 'first', type: 'SvgTrack' }]),
  )
  expect(alone.text('size')).toBe(both.text('size'))
})
