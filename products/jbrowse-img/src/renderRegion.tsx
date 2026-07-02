import { AsyncLocalStorage } from 'node:async_hooks'

import { addDisposer, destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg as renderCircularToSvg } from '@jbrowse/plugin-circular-view'
import { renderToSvg as renderDotplotToSvg } from '@jbrowse/plugin-dotplot-view'
import { renderToSvg as renderSyntenyToSvg } from '@jbrowse/plugin-linear-comparative-view'
import { renderToSvg as renderLinearToSvg } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-app2'
import { createCanvas } from 'canvas'
import { autorun, observable, runInAction, when } from 'mobx'

import {
  applyDisplayOpts,
  applyTrackOpts,
  configTrackCategory,
} from './applyTrackOpts.ts'
import { readData } from './readData.ts'
import { resolveConfigObject } from './resolveHub.ts'
import { initFromSpec, parseSpec, specMode } from './spec.ts'

import type { ViewMode } from './modes.ts'
import type { ViewSpec } from './spec.ts'
import type { Config, Opts } from './types.ts'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { IObservableValue } from 'mobx'

// react-app2 hosts every view type and accepts multiple assemblies, where the
// LGV-only react2 host could not. RPC runs on the main thread (the rpc
// defaultDriver default), so no worker is needed for headless export.
function createModel(data: Config) {
  const model = createViewState({
    config: {
      assemblies: data.assemblies,
      tracks: data.tracks,
      defaultSession: data.defaultSession as { name: string } | undefined,
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  // The interactive app routes failures (a bad track config, an assembly that
  // won't load, an RPC error) to session.notifyError, which only pushes a
  // snackbar — invisible in this headless tool. Echo error notifications to
  // stderr so the real cause is reported. This console.error is also what feeds
  // the error scope that makes the failure fatal (see errorScope).
  const { session } = model
  const reported = new Set<string>()
  addDisposer(
    session,
    autorun(() => {
      for (const { message, level } of session.snackbarMessages) {
        if (level === 'error' && !reported.has(message)) {
          reported.add(message)
          console.error(`jb2export: ${message}`)
        }
      }
    }),
  )
  return model
}

type Model = ReturnType<typeof createModel>

// Per-mode render context. `width` is resolved once so each renderer doesn't
// repeat the default. `spec` is the parsed --spec view object when supplied;
// comparative renderers use it instead of synthesizing a view from flags.
interface ModeContext {
  model: Model
  data: Config
  opts: Opts
  width: number
  spec?: ViewSpec
  scope: ErrorScope
}

type ModeRenderer = (ctx: ModeContext) => Promise<string>

// Every failure in a render funnels through console.error but none of them
// throw: a track's failed data fetch (BaseLinearDisplay's FetchMixin logs
// "Fetch failed:"), a self-init view's init autorun (`console.error(e)`), and
// our own session-error echo (createModel). They log and leave the SVG with that
// track/view blank — a silent partial success that, for a headless export, is a
// broken image written as if it succeeded. So capture that one stream and make
// the first error fatal, rather than reaching into each view's structure.
//
// The capture is scoped with AsyncLocalStorage rather than a global console
// swap: a render's async work (fire-and-forget fetch/init autoruns) can outlive
// the awaited call and log late, and ALS guarantees such a late log is attributed
// to its own render's store — never bleeding into a later render and failing it.
interface ErrorScope {
  errors: unknown[]
  // observable so whenViewReady's `when` re-evaluates when an error is logged
  count: IObservableValue<number>
}
const errorScope = new AsyncLocalStorage<ErrorScope>()

const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  const scope = errorScope.getStore()
  if (scope) {
    // prefer an Error argument (console.error('Fetch failed:', err)) over a
    // leading format string so the thrown cause is the real error
    scope.errors.push(args.find(a => a instanceof Error) ?? args[0])
    runInAction(() => {
      scope.count.set(scope.errors.length)
    })
  }
  originalConsoleError(...args)
}

function throwIfLogged(scope: ErrorScope) {
  if (scope.errors.length > 0) {
    const e = scope.errors[0]
    throw e instanceof Error ? e : new Error(String(e))
  }
}

// Backstop for a view whose init autorun never completes AND never reports an
// error (a promise inside it that neither resolves nor rejects). Generous
// because init only awaits assembly load + navigation + track attach — the
// feature-data fetch happens later in renderToSvg — so a legitimate render
// clears `init` well under this, while a true hang no longer runs forever.
const INIT_TIMEOUT_MS = 120_000

interface InitView {
  setWidth: (n: number) => void
  initialized: boolean
  init?: unknown
}

// A comparative/circular view sets `initialized` true as soon as it has regions
// to show, but its frozen `init` snapshot is consumed a moment later by an async
// autorun (which awaits assemblies, navigates each sub-view, and attaches
// tracks). The SVG only has content once that autorun has cleared `init`. On
// failure the dotplot/synteny autorun deliberately KEEPS `init` set (interactive
// recovery) but logs the error, so waiting on `!init` alone would hang — also
// resolve when an error is logged, which throwIfLogged then rethrows.
async function whenViewReady(view: InitView, scope: ErrorScope) {
  await when(() => (view.initialized && !view.init) || scope.count.get() > 0, {
    timeout: INIT_TIMEOUT_MS,
  }).catch(() => {
    // swallow the timeout rejection; the checks below turn an unresolved init
    // into a descriptive error
  })
  throwIfLogged(scope)
  if (view.init) {
    throw new Error(`view did not initialize within ${INIT_TIMEOUT_MS / 1000}s`)
  }
}

// Shared lifecycle for the self-initializing views (dotplot/synteny/circular):
// add the view from its frozen `init` snapshot, size it, then wait for the init
// autorun to clear `init` before renderToSvg rasterizes via the global node
// canvas (setupEnv).
async function addInitView<T extends InitView>(
  ctx: ModeContext,
  viewType: string,
  init: unknown,
) {
  const view = ctx.model.session.addView(viewType, { init }) as T
  view.setWidth(ctx.width)
  await whenViewReady(view, ctx.scope)
  return view
}

const renderLinear: ModeRenderer = async ({ model, data, opts, width }) => {
  const {
    loc,
    trackList = [],
    showTracks = [],
    session: sessionParam,
    defaultSession,
    themeName,
    showGridlines,
    trackLabels,
    refseq,
  } = opts

  const { session } = model
  const view = (session.views[0] ??
    session.addView('LinearGenomeView', {})) as LinearGenomeViewModel

  view.setWidth(width)

  if (loc) {
    const { name } = data.assembly
    if (loc === 'all') {
      // showAllRegionsInAssembly reads assemblyManager.get(name).regions
      // synchronously and no-ops if the assembly hasn't loaded yet, so wait for
      // it first (navToLocString does this internally for the single-loc case).
      const asm = await session.assemblyManager.waitForAssembly(name)
      if (!asm) {
        throw new Error(
          `assembly "${name}" failed to load (check --fasta/--assembly/--config inputs)`,
        )
      }
      view.showAllRegionsInAssembly(name)
    } else {
      await view.navToLocString(loc, name)
    }
  } else if (!sessionParam && !defaultSession) {
    throw new Error(
      'No --loc specified (e.g. --loc chr1:1-10000 or --loc all). ' +
        'Alternatively pass --session or --defaultSession.',
    )
  }

  if (refseq) {
    const seqTrackId = data.assembly.sequence.trackId
    if (typeof seqTrackId === 'string') {
      view.showTrack(seqTrackId)
    }
  }

  for (const track of trackList) {
    applyTrackOpts(track, view)
  }

  // Hosted trackIds from --track (present in a --hub/--config config). The
  // display category comes from the config track's own type, so modifiers
  // (height:, color:, …) route to the right display slots.
  for (const [, [trackId, ...displayOpts]] of showTracks) {
    if (trackId) {
      applyDisplayOpts(
        view,
        trackId,
        configTrackCategory(data.tracks, trackId),
        displayOpts,
      )
    }
  }

  return renderLinearToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    createCanvas: (w: number, h: number) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
    themeName,
    showGridlines,
    trackLabels,
  })
}

// Build a sub-view spec per assembly in [query, target, …] order: the first
// --fasta/--chromSizes is the query (top in synteny, x-axis in dotplot).
// Comparative views render adjacent assembly pairs as stacked levels, so this
// supports an arbitrary number of assemblies (a-vs-b is the common case). Each
// assembly's optional location comes from data.assemblyLocs (a `loc:` modifier
// or the legacy --loc/--loc2); the rest show their whole genome.
function comparativeViews({ data }: ModeContext) {
  const { assemblies, assemblyLocs = [] } = data
  if (assemblies.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (repeat --fasta/--chromSizes, or use --fasta2)',
    )
  }
  return assemblies.map((asm, i) =>
    assemblyLocs[i]
      ? { assembly: asm.name, loc: assemblyLocs[i] }
      : { assembly: asm.name },
  )
}

// Group synteny track ids by level. Level i sits between assembly i and i+1, so
// a track is placed at the level whose adjacent assembly pair matches its
// assemblyNames. Returns one entry per level (assemblies - 1); tracks with no
// matching pair fall back to level 0.
function syntenyTrackLevels(data: Config) {
  const order = data.assemblies.map(asm => asm.name)
  const levels: string[][] = order.slice(1).map(() => [])
  for (const track of data.tracks) {
    if (track.type === 'SyntenyTrack') {
      const names = track.assemblyNames ?? []
      const level = order.findIndex(
        (name, i) =>
          i < order.length - 1 &&
          names.includes(name) &&
          names.includes(order[i + 1]!),
      )
      levels[level === -1 ? 0 : level]!.push(track.trackId)
    }
  }
  return levels
}

const renderDotplot: ModeRenderer = async ctx => {
  // Dotplot is pairwise (x vs y), so it takes only the first two assemblies even
  // if a config supplies more. init.tracks is a flat list of comparison ids.
  const tracks = ctx.data.tracks
    .filter(track => track.type === 'SyntenyTrack')
    .map(track => track.trackId)
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : {
        views: comparativeViews(ctx).slice(0, 2),
        tracks,
        ...(ctx.opts.autoDiagonalize ? { autoDiagonalize: true } : {}),
      }
  const view = await addInitView<DotplotViewModel>(ctx, 'DotplotView', init)
  return renderDotplotToSvg(view, {
    rasterizeLayers: !ctx.opts.noRasterize,
    themeName: ctx.opts.themeName,
  })
}

// View-level synteny settings from CLI flags, included only when set so they
// don't clobber the view's own defaults. The full set lives in --spec; these are
// the busy-comparison knobs the simple subcommand exposes directly.
function syntenyViewKnobs(opts: Opts) {
  const { autoDiagonalize, drawCurves, minAlignmentLength, colorBy, alpha } =
    opts
  return {
    ...(autoDiagonalize ? { autoDiagonalize: true } : {}),
    ...(drawCurves ? { drawCurves: true } : {}),
    ...(minAlignmentLength === undefined ? {} : { minAlignmentLength }),
    ...(colorBy ? { colorBy } : {}),
    ...(alpha === undefined ? {} : { alpha }),
    ...(opts.levelHeights ? { levelHeights: opts.levelHeights } : {}),
  }
}

const renderSynteny: ModeRenderer = async ctx => {
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : {
        views: comparativeViews(ctx),
        tracks: syntenyTrackLevels(ctx.data),
        ...syntenyViewKnobs(ctx.opts),
      }
  const view = await addInitView<LinearSyntenyViewModel>(
    ctx,
    'LinearSyntenyView',
    init,
  )
  return renderSyntenyToSvg(view, {
    rasterizeLayers: !ctx.opts.noRasterize,
    themeName: ctx.opts.themeName,
    trackLabels: ctx.opts.trackLabels,
    showGridlines: ctx.opts.showGridlines,
  })
}

// Circular renders one assembly's chord tracks (e.g. a VCF of structural
// variants). The view picks each track's chord display automatically.
const renderCircular: ModeRenderer = async ctx => {
  const trackIds = ctx.data.tracks.map(track => track.trackId)
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : { assembly: ctx.data.assembly.name, tracks: trackIds }
  const view = await addInitView<CircularViewModel>(ctx, 'CircularView', init)
  return renderCircularToSvg(view, {
    rasterizeLayers: !ctx.opts.noRasterize,
    themeName: ctx.opts.themeName,
  })
}

// Registry of every render mode. The exhaustive Record means adding a ViewMode
// is a compile error until a renderer is registered here.
const modeRenderers: Record<ViewMode, ModeRenderer> = {
  linear: renderLinear,
  dotplot: renderDotplot,
  synteny: renderSynteny,
  circular: renderCircular,
}

export async function renderRegion(opts: Opts) {
  const data = readData(opts, await resolveConfigObject(opts))
  const model = createModel(data)
  // Set the theme on the session up front: worker-side label/feature colors
  // (e.g. gene-description blue) are baked at feature-fetch time from
  // session.themeOptions, which happens before renderToSvg applies themeName at
  // rasterization. Without this, a dark theme renders feature descriptions in
  // the light-theme dark blue, illegible on the dark track background.
  if (opts.themeName) {
    model.session.setThemeName(opts.themeName)
  }
  const spec = opts.spec ? parseSpec(opts.spec) : undefined
  // an explicit subcommand wins; otherwise a --spec selects its mode from the
  // view type, falling back to the default linear view
  const mode = opts.mode ?? (spec ? specMode(spec) : 'linear')
  const scope: ErrorScope = { errors: [], count: observable.box(0) }
  return errorScope.run(scope, async () => {
    try {
      const result = await modeRenderers[mode]({
        model,
        data,
        opts,
        width: opts.width ?? 1500,
        spec,
        scope,
      })
      // any error logged during the render (a failed track/data fetch, an init
      // that logged-and-continued) means the SVG is incomplete — fail rather
      // than emit a silently-broken image
      throwIfLogged(scope)
      return result
    } finally {
      destroy(model)
    }
  })
}
