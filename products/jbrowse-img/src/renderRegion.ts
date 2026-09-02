import { getEnv } from '@jbrowse/core/util'
import {
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'
import { addDisposer, destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg as renderBreakpointToSvg } from '@jbrowse/plugin-breakpoint-split-view'
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
  configTrackCategory,
  resolveTrackId,
} from './applyTrackOpts.ts'
import { breakpointInit, breakpointPanelsFromSpec } from './breakpointInit.ts'
import {
  dotplotInit,
  dotplotViewKnobs,
  syntenyInit,
  syntenyViewKnobs,
} from './comparativeInit.ts'
import { syntenyTrackTypes } from './makeConfigs.ts'
import { modeDescriptors, subcommandForViewType } from './modes.ts'
import { DEFAULT_FONT_FAMILY, DEFAULT_WIDTH } from './options.ts'
import { readData } from './readData.ts'
import { resolveConfigObject } from './resolveHub.ts'
import { parseSpec, specMode, viewSettingsFromSpec } from './spec.ts'
import { trackType } from './trackFields.ts'

import type { ViewMode } from './modes.ts'
import type { Entry } from './parseArgv.ts'
import type { ViewSpec } from './spec.ts'
import type { Config, OpenTrack, Opts, Track } from './types.ts'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  BreakpointSplitViewInitView,
  BreakpointViewModel,
} from '@jbrowse/plugin-breakpoint-split-view'
import type {
  CircularViewCommands,
  CircularViewModel,
} from '@jbrowse/plugin-circular-view'
import type {
  DotplotViewInit,
  DotplotViewModel,
} from '@jbrowse/plugin-dotplot-view'
import type {
  LinearSyntenyViewInit,
  LinearSyntenyViewModel,
} from '@jbrowse/plugin-linear-comparative-view'
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
  // snackbar — invisible in this headless tool. The FIRST error-level snackbar
  // always becomes the thrown error (firstRenderError → throwOnRenderError, see
  // renderRegion / whenViewReady) and so is reported by whoever catches it;
  // echoing it here too printed every failure twice. Echo only the errors after
  // it, which have nothing else to surface them.
  const { session } = model
  const reported = new Set<string>()
  addDisposer(
    session,
    autorun(() => {
      // session.snackbarMessages is a volatile observable array typed `any` at
      // this boundary, so annotate the element rather than inherit the implicit
      // any the destructuring below would silently accept
      const errors = session.snackbarMessages.filter(
        (m: SnackbarMessage) => m.level === 'error',
      )
      for (const { message } of errors.slice(1)) {
        if (!reported.has(message)) {
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
  // Load the assembly up front and report a load failure as itself.
  // waitForAssembly resolves only once regions AND refNameAliases are in, but
  // navToLocString swallows its rejection and falls through to the locstring
  // parse — so a chromAlias fetch that fails (hg19's comes from
  // hgdownload.soe.ucsc.edu, and does fail under a concurrent regen) surfaced as
  // `UnknownRefNameError: unknown reference sequence name in location "1:..."`,
  // which reads as a broken alias table rather than the transient fetch it is.
  const assembly = await session.assemblyManager
    .waitForAssembly(assemblyName)
    .catch((e: unknown) => {
      throw new Error(
        `Failed to load assembly "${assemblyName}" (sequence, regions or refName aliases)`,
        { cause: e },
      )
    })
  const hit = hasSearchIndex
    ? (
        await fetchResults({
          queryString: input,
          searchType: 'exact',
          assemblyName,
          textSearchManager: session.textSearchManager,
          assembly,
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

// Rasterized layers draw into a real node-canvas rather than whatever jsdom
// hands back from document.createElement, so PNG-embedded layers (alignments,
// wiggle, synteny ribbons) come out drawn instead of blank.
const nodeCanvas = (w: number, h: number) =>
  createCanvas(w, h) as unknown as HTMLCanvasElement

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

interface InitView {
  setWidth: (n: number) => void
  initialized: boolean
  pendingLaunch?: unknown
}

// A comparative/circular view sets `initialized` true as soon as it has regions
// to show, but its launch blob is consumed a moment later by an async autorun
// (which awaits assemblies, navigates each sub-view, and attaches tracks). The
// SVG only has content once that autorun has cleared it. On failure the
// dotplot/synteny autorun deliberately KEEPS the blob (interactive recovery) but
// reports the error to the session, so waiting on `!pendingLaunch` alone would
// hang — also resolve on a session error, which is then rethrown.
//
// `pendingLaunch` and NOT the views' own `initPending`, which looks like the
// obvious predicate and is the wrong one here: that getter answers "should a
// loading indicator show", and LinearGenomeView's clears the moment
// displayedRegions land — while the same apply pass still has `tracks` to attach
// and `highlight` to place. Rendering there would emit a positioned view with
// its tracks missing. The blob is cleared only once the whole pass is done,
// which is the question this is actually asking.
//
// Deliberately unbounded. A time limit here can only mislabel a stuck fetch as
// "the view didn't initialize", and the same reasoning already removed the 60s
// bound from core's awaitSvgReady: if a view can reach a state where neither
// disjunct ever becomes true, that view's launch is the bug, not this wait.
async function whenViewReady(view: InitView, session: RenderErrorSources) {
  await when(
    () =>
      (view.initialized && !view.pendingLaunch) ||
      firstRenderError(session) !== undefined,
  )
  throwOnRenderError(session)
}

// Shared lifecycle for the self-initializing views (dotplot/synteny/circular):
// add the view from its settings, size it, then wait for the launch autorun to
// consume them before renderToSvg rasterizes via the global node canvas
// (setupEnv).
//
// The settings are the view's own launch interface (DotplotViewInit and
// friends) or, on the --spec path, the user's JSON — which is unvalidated by
// construction, so that branch stays a loose record. Each CLI-built one goes
// through a typed builder below, so a field the view no longer reads fails the
// build rather than silently doing nothing.
type SpecSettings = Record<string, unknown>

// The one gate between "I have a view" and "I can render it": size it, then
// wait for the launch blob to be consumed.
//
// It belongs to *holding* a view rather than to having just built one, which is
// the distinction this used to get wrong. A view carries a launch blob whether
// this tool synthesized it from flags (addLaunchView below) or a `--session` /
// `--defaultSession` supplied one already carrying it — `launch` is a persisted
// prop on LinearGenomeView, DotplotView and LinearSyntenyView alike, applied by
// the shared `installInitAutorun` state machine. Waiting only in the construct
// path meant the one view type this tool ADOPTS rather than builds, the LGV in
// renderLinear, never awaited its launch: the positioned-on-a-region check ran
// against a view whose navigation autorun had not finished, so a session
// carrying `{assembly, loc, tracks}` on the view failed with "has no view
// positioned on a region" instead of rendering.
//
// Free for a view with nothing to wait for: an LGV with nothing pending has no
// displayed regions yet, so `assemblyNames` is empty, `assembliesInitialized` is
// vacuously true, and this resolves as soon as `setWidth` lands.
async function readyView<T extends InitView>(view: T, ctx: ModeContext) {
  view.setWidth(ctx.width)
  await whenViewReady(view, ctx.model.session)
  return view
}

// session.views[] elements are typed `any` (pluggableMstType), so the view-type
// discriminator is read through this rather than off `any`.
function sessionViewType(session: Model['session']): string | undefined {
  return session.views[0]?.type
}

// The session holds a view this subcommand cannot draw. Casting it and rendering
// anyway died several statements later on a field the other view type has no
// version of, which reads as a corrupt session rather than as the wrong
// subcommand.
function wrongViewTypeError(opts: Opts, suppliedType: string) {
  return new Error(
    `the ${opts.session ? '--session' : 'defaultSession'} holds a ${suppliedType}; render it with "jb2export ${subcommandForViewType(suppliedType) ?? '<subcommand>'}"`,
  )
}

// The trackIds `--track` named, each with the display modifiers that followed
// it. The token is resolved to a real trackId (accepting the
// assembly-name-prefix shorthand); a file flag's id was already assigned when
// readData built its config.
function resolvedShowTracks(
  showTracks: Entry[] | undefined,
  data: Config,
): OpenTrack[] {
  return (showTracks ?? []).map(([, [trackInput, ...opts]]) => {
    if (!trackInput) {
      // a bare `--track` used to be skipped in silence, so the track the user
      // meant to show just wasn't there
      throw new Error(
        '--track requires a trackId (list them with "jb2export list <hub>")',
      )
    }
    return {
      trackId: resolveTrackId(data.tracks, trackInput, data.assembly.name),
      opts,
    }
  })
}

// The view to render: the one a --session/--defaultSession supplied, if it is of
// this type, else one built from `makeSettings`.
//
// `--session` is listed in every subcommand's help, but only renderLinear ever
// adopted the view it carried — dotplot/synteny/circular each added a SECOND
// view from CLI flags and rendered that, so a saved synteny session exported a
// view the user never arranged. A session holding some OTHER view type was the
// same silence one step further along, and now gets the error renderLinear
// already gives for the reverse direction. `--spec` is the opposite case: it
// describes a view to construct, so it wins over whatever the session holds.
//
// The settings arrive as a thunk because building them can THROW on flags the
// adopted view makes irrelevant — breakpointInit demands two --loc,
// comparativeViews two assemblies. Built eagerly, `jb2export breakpoint
// --session sv.json` failed on the missing --loc before it could adopt the very
// view it was pointed at, so the advice renderLinear's error gives led nowhere.
async function addLaunchView<T extends InitView>(
  ctx: ModeContext,
  viewType: string,
  makeSettings: () =>
    | SpecSettings
    | DotplotViewInit
    | LinearSyntenyViewInit
    | CircularViewCommands
    // one entry per stacked panel, which is what BreakpointSplitView's `views`
    // takes as a recipe
    | { views: BreakpointSplitViewInitView[] },
) {
  const { session } = ctx.model
  const suppliedType = ctx.spec ? undefined : sessionViewType(session)
  if (suppliedType !== undefined && suppliedType !== viewType) {
    throw wrongViewTypeError(ctx.opts, suppliedType)
  }
  const view =
    suppliedType === viewType
      ? session.views[0]
      : session.addView(viewType, makeSettings())
  return readyView(view as T, ctx)
}

const renderLinear: ModeRenderer = async ctx => {
  const { model, data, opts } = ctx
  const {
    loc,
    showTracks,
    session: sessionParam,
    defaultSession,
    showGridlines,
    trackLabels,
    refseq,
  } = opts

  const { session } = model
  const suppliedType = sessionViewType(session)
  if (suppliedType !== undefined && suppliedType !== 'LinearGenomeView') {
    throw wrongViewTypeError(opts, suppliedType)
  }
  // Adopted from the session when one supplied a view, else synthesized. Either
  // way it goes through readyView, so an `init` the session carried is applied
  // before anything below reads the view's position — and before `--loc`, which
  // is an explicit instruction from the command line and so wins over whatever
  // the session's init navigated to.
  const view = await readyView(
    (session.views[0] ??
      session.addView('LinearGenomeView', {})) as LinearGenomeViewModel,
    ctx,
  )

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
  } else if (!view.displayedRegions.length) {
    // Without --loc the session IS the region, so a session that reaches here
    // carrying no view (or a view positioned nowhere) renders an empty ruler and
    // nothing else. That came out as a ~500-byte SVG with nothing reported —
    // same class of failure as a track whose data won't load, which the
    // renderers now throw on themselves, so it fails the same way rather than
    // writing a blank image.
    throw new Error(
      `the ${sessionParam ? '--session' : 'defaultSession'} has no view positioned on a region; pass --loc to say where to render`,
    )
  }

  if (refseq) {
    const seqTrackId = data.assembly.sequence.trackId
    if (typeof seqTrackId === 'string') {
      view.showTrack(seqTrackId)
    }
  }

  // Hosted trackIds from --track (present in a --hub/--config config) go first,
  // so they land above the file-type (--bam/--gffgz/--hic/...) tracks readData
  // built — argv order top-to-bottom, same convention as every other stacked
  // view in this CLI (synteny levels, multi-way assemblies). Both then take the
  // same path: the display category comes from the track's own type in the
  // config, so modifiers (height:, color:, …) route to the right display slots
  // whichever way the track got there.
  const toOpen = [
    ...resolvedShowTracks(showTracks, data),
    ...(data.openTracks ?? []),
  ]
  for (const { trackId, opts } of toOpen) {
    applyDisplayOpts(
      view,
      trackId,
      configTrackCategory(data.tracks, trackId),
      opts,
    )
  }

  const svg = await renderLinearToSvg(view, {
    ...baseSvgOpts(opts),
    createCanvas: nodeCanvas,
    showGridlines,
    trackLabels,
  })
  return svg
}

const renderDotplot: ModeRenderer = async ctx => {
  const view = await addLaunchView<DotplotViewModel>(ctx, 'DotplotView', () =>
    ctx.spec
      ? viewSettingsFromSpec(ctx.spec, dotplotViewKnobs(ctx.opts))
      : dotplotInit(ctx.data, ctx.opts),
  )
  const svg = await renderDotplotToSvg(view, baseSvgOpts(ctx.opts))
  return svg
}

const renderSynteny: ModeRenderer = async ctx => {
  const view = await addLaunchView<LinearSyntenyViewModel>(
    ctx,
    'LinearSyntenyView',
    () =>
      ctx.spec
        ? viewSettingsFromSpec(ctx.spec, syntenyViewKnobs(ctx.opts))
        : syntenyInit(ctx.data, ctx.opts),
  )
  const svg = await renderSyntenyToSvg(view, {
    ...baseSvgOpts(ctx.opts),
    createCanvas: nodeCanvas,
    trackLabels: ctx.opts.trackLabels,
    showGridlines: ctx.opts.showGridlines,
  })
  return svg
}

// Which of the config's tracks a CircularView can actually open: it renders
// chord displays only, so a track type with none (a --bigwig passed alongside
// the SVs, or the whole track set of a --hub/--config) made showTrack throw
// "Could not find a compatible display for view type CircularView" and abort the
// entire render. Ask the question showTrackGeneric asks — does this track type
// declare a display this view supports — and skip the ones it would reject, so
// the chords still render. Warns per skipped track so the omission is visible.
function circularTrackIds(model: Model, tracks: Track[]) {
  const { pluginManager } = getEnv(model)
  const supported = viewDisplayNames(pluginManager, 'CircularView')
  const compatible = tracks.filter(track => {
    const type = trackType(track)
    // includes the type this bundle doesn't register at all, which a
    // --hub/--config config can easily carry (a track type from a plugin
    // jb2export doesn't bundle) and which used to throw from inside the very
    // filter meant to skip untenable tracks
    const ok = viewCanDisplayTrack(pluginManager, supported, type)
    if (!ok) {
      console.warn(
        `Warning: skipping track "${track.trackId}" (${type}) — it has no display the circular view can render`,
      )
    }
    return ok
  })
  return compatible.map(track => track.trackId)
}

// Circular renders one assembly's chord tracks (e.g. a VCF of structural
// variants); the view picks each track's chord display automatically. Unlike the
// comparative builders this needs the model (circularTrackIds asks the
// pluginManager which tracks the view can open), so it stays here rather than in
// comparativeInit.ts.
function circularInit(ctx: ModeContext): CircularViewCommands {
  return {
    assembly: ctx.data.assembly.name,
    tracks: circularTrackIds(ctx.model, ctx.data.tracks),
  }
}

const renderCircular: ModeRenderer = async ctx => {
  const view = await addLaunchView<CircularViewModel>(
    ctx,
    'CircularView',
    () => (ctx.spec ? viewSettingsFromSpec(ctx.spec) : circularInit(ctx)),
  )
  const svg = await renderCircularToSvg(view, baseSvgOpts(ctx.opts))
  return svg
}

// A window per locstring in --loc, stacked, with the reads that leave one and
// arrive in another drawn between them. Unlike the comparative modes this reads
// --track, because its panels are ordinary LGVs and the whole picture is the
// tracks on them: with no track there is nothing to connect and the export is a
// stack of empty rulers. The modifiers that follow a --track reach the panels
// through breakpointTracks, which is the one route a panel's launch blob has.
//
// The view's panels are its `views`, one entry per panel, which is why this
// does not go through `viewSettingsFromSpec` the way the single-blob modes do —
// but it is the same launch state machine underneath, so
// `addLaunchView`/`readyView` wait on it identically.
const renderBreakpoint: ModeRenderer = async ctx => {
  const { data, opts, model } = ctx
  const view = await addLaunchView<BreakpointViewModel>(
    ctx,
    'BreakpointSplitView',
    () => ({
      views: ctx.spec
        ? breakpointPanelsFromSpec(ctx.spec)
        : breakpointInit(data, opts, resolvedShowTracks(opts.showTracks, data)),
    }),
  )
  // A SECOND wait, because this view's launch state is consumed one level above
  // the one that matters. Its autorun turns the panel array into sub-views and
  // clears it in the same tick, so `readyView` is satisfied the moment the
  // panels EXIST — while each sub-view still carries its own pending launch
  // holding the loc and, decisively, the tracks. Rendering there produced two
  // correctly
  // positioned, correctly labelled, completely empty panels: the exact
  // failure `whenViewReady` warns about for LGV's `initPending`, one level of
  // nesting further out. Unconditional, since an adopted session view's panels
  // carry their own launches just as a freshly built one's do.
  await when(
    () =>
      view.views.every(v => !v.pendingLaunch) ||
      firstRenderError(model.session) !== undefined,
  )
  throwOnRenderError(model.session)
  const svg = await renderBreakpointToSvg(view, {
    ...baseSvgOpts(opts),
    createCanvas: nodeCanvas,
    trackLabels: opts.trackLabels,
    showGridlines: opts.showGridlines,
  })
  return svg
}

// Options only renderLinear reads. A comparative or circular view takes its
// tracks from its own launch blob (or --spec), so a --track/--refseq passed to one is
// dropped; --loc positions the sub-views of a comparative view but means nothing
// to a circular one, which always shows the whole assembly. main.ts warns about
// the reverse — comparative flags in a linear run — so say this here rather than
// leave the non-linear direction silent.
//
// Breakpoint is the one non-linear mode that DOES read --track: its panels are
// ordinary LGVs and the tracks on them are the whole picture.
function warnLinearOnlyOptions(mode: ViewMode, opts: Opts) {
  if (mode === 'linear') {
    return
  }
  // A comparative view's levels are made of the synteny files, and it opens
  // nothing else — so `--fasta a --paf x --fasta b --bigwig sig.bw` built the
  // bigwig's track config and then showed it nowhere. Circular is exempt: it
  // picks its chord tracks out of the whole config.
  const droppedFiles = modeDescriptors[mode].comparative
    ? [
        ...new Set(
          (opts.trackList ?? [])
            .map(([type]) => type)
            .filter(type => !syntenyTrackTypes.includes(type)),
        ),
      ].map(type => `--${type}`)
    : []
  const ignored = [
    opts.showTracks?.length && mode !== 'breakpoint' ? '--track' : '',
    opts.refseq ? '--refseq' : '',
    mode === 'circular' && opts.loc ? '--loc' : '',
    ...droppedFiles,
  ].filter(Boolean)
  if (ignored.length) {
    console.warn(
      `Warning: ${ignored.join(', ')} ${ignored.length > 1 ? 'have' : 'has'} no effect on a ${mode} view`,
    )
  }
}

// Registry of every render mode. The exhaustive Record means adding a ViewMode
// is a compile error until a renderer is registered here.
const modeRenderers: Record<ViewMode, ModeRenderer> = {
  linear: renderLinear,
  dotplot: renderDotplot,
  synteny: renderSynteny,
  circular: renderCircular,
  breakpoint: renderBreakpoint,
}

/**
 * `configObject` is an already-fetched config standing in for this call's own
 * `resolveConfigObject`. Only a batch passes it: `--hub`/a URL `--config` is one
 * fetch per call otherwise, so a 400-junction run made 400 requests for the same
 * file — and for a `--hub` that includes 400 chromAlias fetches from UCSC, which
 * is 400 chances to hit the transient failure `navToLocOrGene` describes rather
 * than one.
 *
 * `readData` MUTATES what it is given (tracks, assembly, openTracks), so a
 * caller reusing one across calls has to hand over a copy each time.
 */
export async function renderRegion(opts: Opts, configObject?: Config) {
  const data = readData(opts, configObject ?? (await resolveConfigObject(opts)))
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
  warnLinearOnlyOptions(mode, opts)
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
    // emit a silently-broken image. Per-track data-load errors need no check
    // here: `renderToSvg` fails on them itself now (each display's
    // `awaitSvgReady`), rather than drawing the error into the figure for a
    // post-hoc pass over `view.tracks` to read back out of the model.
    throwOnRenderError(model.session)
    return result
  } finally {
    destroy(model)
  }
}
