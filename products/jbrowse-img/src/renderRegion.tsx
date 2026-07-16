import { addDisposer, destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg as renderCircularToSvg } from '@jbrowse/plugin-circular-view'
import { renderToSvg as renderDotplotToSvg } from '@jbrowse/plugin-dotplot-view'
import { renderToSvg as renderSyntenyToSvg } from '@jbrowse/plugin-linear-comparative-view'
import {
  fetchResults,
  renderToSvg as renderLinearToSvg,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-app2'
import { createCanvas } from 'canvas'
import { autorun, when } from 'mobx'

import {
  applyDisplayOpts,
  applyTrackOpts,
  configTrackCategory,
  resolveTrackId,
} from './applyTrackOpts.ts'
import { DEFAULT_FONT_FAMILY, DEFAULT_WIDTH } from './options.ts'
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

// react-app2 hosts every view type and accepts multiple assemblies, where the
// LGV-only react2 host could not. RPC runs on the main thread (the rpc
// defaultDriver default), so no worker is needed for headless export.
function createModel(data: Config) {
  const model = createViewState({
    config: {
      assemblies: data.assemblies,
      tracks: data.tracks,
      // carried through so --loc can navigate by gene name via the hub's Trix
      // index (see navToLocStringOrSearch)
      aggregateTextSearchAdapters: data.aggregateTextSearchAdapters,
      defaultSession: data.defaultSession as { name: string } | undefined,
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  // The interactive app routes failures (a bad track config, an assembly that
  // won't load, an RPC error) to session.notifyError, which only pushes a
  // snackbar — invisible in this headless tool. Echo error notifications to
  // stderr so the real cause is reported. These same errors are made fatal via
  // throwOnRenderError (see renderRegion / whenViewReady).
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

// Navigate the view to --loc. A locstring (chr1:1-100) or bare refname navigates
// directly. When the config carries a text-search index (e.g. from --hub), a
// gene name is resolved through it and the view jumps to the top hit's location.
// We search first (rather than lean on navToLocString's own search) because on
// multiple hits navToLocString queues an interactive picker dialog — invisible,
// and unanswerable, in a headless render — whereas here we just take the top hit.
// A locstring simply returns no text-search hits and falls through to navToLocString.
async function navToLocOrGene(
  view: LinearGenomeViewModel,
  session: Model['session'],
  input: string,
  assemblyName: string,
  hasSearchIndex: boolean,
) {
  const hit = hasSearchIndex
    ? (
        await fetchResults({
          queryString: input,
          searchType: 'exact',
          searchScope: view.searchScope(assemblyName),
          textSearchManager: session.textSearchManager,
          assembly: await session.assemblyManager.waitForAssembly(assemblyName),
        })
      ).find(r => r.hasLocation())
    : undefined
  await view.navToLocString(hit?.getLocation() ?? input, assemblyName)
}

// Per-mode render context. `width` is resolved once so each renderer doesn't
// repeat the default. `spec` is the parsed --spec view object when supplied;
// comparative renderers use it instead of synthesizing a view from flags.
interface ModeContext {
  model: Model
  data: Config
  opts: Opts
  width: number
  spec?: ViewSpec
}

type ModeRenderer = (ctx: ModeContext) => Promise<string>

// The renderToSvg options every mode shares. `rasterizeLayers` is single-sourced
// here so the `--noRasterize` inversion isn't repeated per renderer; linear and
// synteny spread this and add their trackLabels/showGridlines on top.
function baseSvgOpts(opts: Opts) {
  return {
    rasterizeLayers: !opts.noRasterize,
    themeName: opts.themeName,
    fontFamily: opts.fontFamily ?? DEFAULT_FONT_FAMILY,
  }
}

// Errors reported through the session that must be fatal in the headless tool
// rather than producing a blank render. Two sources:
//  - session.notifyError (bad track config, navigation failure, a comparative
//    view's init autorun) → an error-level snackbar
//  - a failed assembly load → assembly.error. Most views route this to a
//    snackbar by awaiting waitForAssembly in their init, but CircularView reads
//    assemblyManager.get() without awaiting, so its bad-assembly error only
//    lives here — check it directly so circular fails fast instead of hanging.
interface RenderErrorSources {
  snackbarMessages: { message: string; level?: string }[]
  assemblyManager: { assemblies: { error?: unknown }[] }
}

function firstRenderError(session: RenderErrorSources): unknown {
  const snackbar = session.snackbarMessages.find(m => m.level === 'error')
  return (
    snackbar?.message ??
    session.assemblyManager.assemblies.find(a => a.error)?.error
  )
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

function throwOnRenderError(session: RenderErrorSources) {
  const error = firstRenderError(session)
  if (error !== undefined) {
    throw toError(error)
  }
}

// A track whose data can't be loaded (a 404 / missing file / parse failure) has
// its error caught by the fetch layer and stored on the display — the render
// still returns with that track blank. Read it back so a headless export fails
// loudly instead of writing a broken image.
function throwOnDisplayError(displays: { error?: unknown }[]) {
  for (const { error } of displays) {
    if (error) {
      throw toError(error)
    }
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
// recovery) but reports the error to the session, so waiting on `!init` alone
// would hang — also resolve on a session error, which is then rethrown.
async function whenViewReady(view: InitView, session: RenderErrorSources) {
  await when(
    () =>
      (view.initialized && !view.init) ||
      firstRenderError(session) !== undefined,
    { timeout: INIT_TIMEOUT_MS },
  ).catch(() => {
    // swallow the timeout rejection; the checks below turn an unresolved init
    // into a descriptive error
  })
  throwOnRenderError(session)
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
  await whenViewReady(view, ctx.model.session)
  return view
}

const renderLinear: ModeRenderer = async ({ model, data, opts, width }) => {
  const {
    loc,
    trackList = [],
    showTracks = [],
    session: sessionParam,
    defaultSession,
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
      await navToLocOrGene(
        view,
        session,
        loc,
        name,
        !!data.aggregateTextSearchAdapters?.length,
      )
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

  // Hosted trackIds from --track (present in a --hub/--config config) go first,
  // so they land above the file-type (--bam/--gffgz/--hic/...) tracks added
  // below — argv order top-to-bottom, same convention as every other stacked
  // view in this CLI (synteny levels, multi-way assemblies). The token is
  // resolved to a real trackId (accepting the assembly-name-prefix shorthand),
  // then the display category comes from that track's own type so modifiers
  // (height:, color:, …) route to the right display slots.
  for (const [, [trackInput, ...displayOpts]] of showTracks) {
    if (trackInput) {
      const trackId = resolveTrackId(
        data.tracks,
        trackInput,
        data.assembly.name,
      )
      applyDisplayOpts(
        view,
        trackId,
        configTrackCategory(data.tracks, trackId),
        displayOpts,
      )
    }
  }

  for (const track of trackList) {
    applyTrackOpts(track, view)
  }

  const svg = await renderLinearToSvg(view, {
    ...baseSvgOpts(opts),
    createCanvas: (w: number, h: number) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
    showGridlines,
    trackLabels,
  })
  throwOnDisplayError(view.tracks.flatMap(t => t.displays))
  return svg
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
        ...(ctx.opts.showColorLegend ? { showColorLegend: true } : {}),
      }
  const view = await addInitView<DotplotViewModel>(ctx, 'DotplotView', init)
  const svg = await renderDotplotToSvg(view, baseSvgOpts(ctx.opts))
  throwOnDisplayError(view.tracks.flatMap(t => t.displays))
  return svg
}

// View-level synteny settings from CLI flags, included only when set so they
// don't clobber the view's own defaults. The full set lives in --spec; these are
// the busy-comparison knobs the simple subcommand exposes directly.
function syntenyViewKnobs(opts: Opts) {
  const {
    autoDiagonalize,
    drawCurves,
    minAlignmentLength,
    colorBy,
    alpha,
    cigarMode,
    showColorLegend,
  } = opts
  return {
    ...(autoDiagonalize ? { autoDiagonalize: true } : {}),
    ...(drawCurves ? { drawCurves: true } : {}),
    ...(minAlignmentLength === undefined ? {} : { minAlignmentLength }),
    ...(colorBy ? { colorBy } : {}),
    ...(alpha === undefined ? {} : { alpha }),
    ...(opts.levelHeights ? { levelHeights: opts.levelHeights } : {}),
    ...(cigarMode ? { cigarMode } : {}),
    ...(showColorLegend ? { showColorLegend: true } : {}),
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
  const svg = await renderSyntenyToSvg(view, {
    ...baseSvgOpts(ctx.opts),
    trackLabels: ctx.opts.trackLabels,
    showGridlines: ctx.opts.showGridlines,
  })
  // synteny keeps its tracks per level, unlike the flat `tracks` of the others
  throwOnDisplayError(
    view.levels.flatMap(l => l.tracks).flatMap(t => t.displays),
  )
  return svg
}

// Circular renders one assembly's chord tracks (e.g. a VCF of structural
// variants). The view picks each track's chord display automatically.
const renderCircular: ModeRenderer = async ctx => {
  const trackIds = ctx.data.tracks.map(track => track.trackId)
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : { assembly: ctx.data.assembly.name, tracks: trackIds }
  const view = await addInitView<CircularViewModel>(ctx, 'CircularView', init)
  const svg = await renderCircularToSvg(view, baseSvgOpts(ctx.opts))
  throwOnDisplayError(view.tracks.flatMap(t => t.displays))
  return svg
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
  try {
    const result = await modeRenderers[mode]({
      model,
      data,
      opts,
      width: opts.width ?? DEFAULT_WIDTH,
      spec,
    })
    // a failure reported to the session during the render (a bad track config,
    // a failed assembly load) means the SVG is incomplete — fail rather than
    // emit a silently-broken image (per-track data-load errors are caught in
    // each renderer via throwOnDisplayError)
    throwOnRenderError(model.session)
    return result
  } finally {
    destroy(model)
  }
}
