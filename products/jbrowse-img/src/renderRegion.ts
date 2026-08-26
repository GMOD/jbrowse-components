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
  buildRScript,
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
import { breakpointInit, breakpointInitFromSpec } from './breakpointInit.ts'
import { dotplotInit, syntenyInit } from './comparativeInit.ts'
import { subcommandForViewType } from './modes.ts'
import { DEFAULT_FONT_FAMILY, DEFAULT_WIDTH } from './options.ts'
import { readData } from './readData.ts'
import { resolveConfigObject } from './resolveHub.ts'
import { initFromSpec, parseSpec, specMode } from './spec.ts'
import { trackType } from './trackFields.ts'
import { filterInitTracks, trackSkipper } from './unsupportedTracks.ts'

import type { ViewMode } from './modes.ts'
import type { ViewSpec } from './spec.ts'
import type { Config, Opts, Track } from './types.ts'
import type { TrackSkipper } from './unsupportedTracks.ts'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  BreakpointSplitViewInitView,
  BreakpointViewModel,
} from '@jbrowse/plugin-breakpoint-split-view'
import type {
  CircularViewInit,
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
  // Is this a config track no bundled plugin can build? Every "open this track"
  // path asks before opening, and asking is what reports it (unsupportedTracks.ts).
  skipTrack: TrackSkipper
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

// A track whose data can't be loaded (a 404 / missing file / parse failure) has
// its error caught by the fetch layer and stored on the display — the render
// still returns with that track blank. The image path reaches this through
// renderToSvg, which awaits each display's gate and throws; `--out fig.R` emits
// no image and so has to read the displays back itself, or a broken track
// becomes a script that silently draws nothing for it.
function throwOnDisplayError(tracks: { displays: { error?: unknown }[] }[]) {
  for (const { error } of tracks.flatMap(t => t.displays)) {
    if (error) {
      throw toError(error)
    }
  }
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
  init?: unknown
}

// A comparative/circular view sets `initialized` true as soon as it has regions
// to show, but its frozen `init` snapshot is consumed a moment later by an async
// autorun (which awaits assemblies, navigates each sub-view, and attaches
// tracks). The SVG only has content once that autorun has cleared `init`. On
// failure the dotplot/synteny autorun deliberately KEEPS `init` set (interactive
// recovery) but reports the error to the session, so waiting on `!init` alone
// would hang — also resolve on a session error, which is then rethrown.
//
// `!init` and NOT the views' own `initPending`, which looks like the obvious
// predicate and is the wrong one here: that getter answers "should a loading
// indicator show", and LinearGenomeView's clears the moment displayedRegions
// land — while the same apply pass still has `init.tracks` to attach and
// `init.highlight` to place. Rendering there would emit a positioned view with
// its tracks missing. `init` is cleared only once the whole pass is done, which
// is the question this is actually asking.
//
// Deliberately unbounded. A time limit here can only mislabel a stuck fetch as
// "the view didn't initialize", and the same reasoning already removed the 60s
// bound from core's awaitSvgReady: if a view can reach a state where neither
// disjunct ever becomes true, that view's init is the bug, not this wait.
async function whenViewReady(view: InitView, session: RenderErrorSources) {
  await when(
    () =>
      (view.initialized && !view.init) ||
      firstRenderError(session) !== undefined,
  )
  throwOnRenderError(session)
}

// Shared lifecycle for the self-initializing views (dotplot/synteny/circular):
// add the view from its frozen `init` snapshot, size it, then wait for the init
// autorun to clear `init` before renderToSvg rasterizes via the global node
// canvas (setupEnv).
//
// `init` is the view's own init interface (DotplotViewInit and friends) or, on
// the --spec path, the user's JSON — which is unvalidated by construction, so
// that branch stays a loose record. Each CLI-built init goes through a typed
// builder below, so a field the view no longer reads fails the build rather than
// silently doing nothing.
type SpecInit = Record<string, unknown>

// The one gate between "I have a view" and "I can render it": size it, then
// wait for any `init` blob to be consumed.
//
// It belongs to *holding* a view rather than to having just built one, which is
// the distinction this used to get wrong. A view carries an `init` whether this
// tool synthesized it from flags (addInitView below) or a `--session` /
// `--defaultSession` supplied one already carrying it — `init` is a persisted
// prop on LinearGenomeView, DotplotView and LinearSyntenyView alike, applied by
// the shared `installInitAutorun` state machine. Waiting only in the construct
// path meant the one view type this tool ADOPTS rather than builds, the LGV in
// renderLinear, never awaited its init: the positioned-on-a-region check ran
// against a view whose navigation autorun had not finished, so a session using
// the modern `init: {assembly, loc, tracks}` form failed with "has no view
// positioned on a region" instead of rendering.
//
// Free for a view with nothing to wait for: an LGV with no `init` has no
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

// The view to render: the one a --session/--defaultSession supplied, if it is of
// this type, else one built from `init`.
//
// `--session` is listed in every subcommand's help, but only renderLinear ever
// adopted the view it carried — dotplot/synteny/circular each added a SECOND
// view from CLI flags and rendered that, so a saved synteny session exported a
// view the user never arranged. `--spec` is the opposite case: it describes a
// view to construct, so it wins over whatever the session holds.
async function addInitView<T extends InitView>(
  ctx: ModeContext,
  viewType: string,
  init:
    | SpecInit
    | DotplotViewInit
    | LinearSyntenyViewInit
    | CircularViewInit
    // BreakpointSplitView's own init is an ARRAY, one entry per stacked panel
    | BreakpointSplitViewInitView[],
) {
  const { session } = ctx.model
  const existing =
    !ctx.spec && sessionViewType(session) === viewType
      ? session.views[0]
      : session.addView(viewType, { init })
  return readyView(existing as T, ctx)
}

const renderLinear: ModeRenderer = async ctx => {
  const { model, data, opts } = ctx
  const {
    loc,
    showTracks = [],
    session: sessionParam,
    defaultSession,
    showGridlines,
    trackLabels,
    refseq,
  } = opts

  const { session } = model
  // A session can hold any view type, and this renderer draws only an LGV;
  // casting whatever it holds died several statements later on
  // `view.displayedRegions.length` (a dotplot has no such field), which reads as
  // a corrupt session rather than the wrong subcommand.
  const suppliedType = sessionViewType(session)
  if (suppliedType !== undefined && suppliedType !== 'LinearGenomeView') {
    throw new Error(
      `the ${sessionParam ? '--session' : 'defaultSession'} holds a ${suppliedType}; render it with "jb2export ${subcommandForViewType(suppliedType) ?? '<subcommand>'}"`,
    )
  }
  // Adopted from the session when one supplied a view, else synthesized. Either
  // way it goes through readyView, so an `init` the session carried is applied
  // before anything below reads the view's position — and before `--loc`, which
  // is an explicit instruction from the command line and so wins over whatever
  // the session's init navigated to.
  //
  // A --spec wins over both, matching the comparative renderers: it describes a
  // view to construct. Its fields ARE the LGV's `init` snapshot (assembly / loc
  // / tracks / highlight), so `&session=spec-…` lifted out of a jbrowse URL
  // renders unchanged — no translation, and nothing here to keep in step with
  // InitState as it grows.
  const view = ctx.spec
    ? await addInitView<LinearGenomeViewModel>(
        ctx,
        'LinearGenomeView',
        initFromSpec(ctx.spec),
      )
    : await readyView(
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
  } else if (!sessionParam && !defaultSession && !ctx.spec) {
    throw new Error(
      'No --loc specified (e.g. --loc chr1:1-10000 or --loc all). ' +
        'Alternatively pass --session, --defaultSession or --spec.',
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
  // view in this CLI (synteny levels, multi-way assemblies). A --track token is
  // resolved to a real trackId (accepting the assembly-name-prefix shorthand);
  // a file flag's id was already assigned when its config was built. Both then
  // take the same path: the display category comes from the track's own type in
  // the config, so modifiers (height:, color:, …) route to the right display
  // slots whichever way the track got there.
  const toOpen = [
    ...showTracks.map(([, [trackInput, ...opts]]) => {
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
    }),
    ...(data.openTracks ?? []),
  ]
  // A track this build has no plugin for is dropped here rather than at the
  // resolve above, so `--track cpgisland_ucsc_hg38` still resolves (and a typo
  // still gets its near-match suggestion); the skip was already announced when
  // the config was scanned.
  for (const { trackId, opts } of toOpen.filter(
    t => !ctx.skipTrack(t.trackId),
  )) {
    applyDisplayOpts(
      view,
      trackId,
      configTrackCategory(data.tracks, trackId),
      opts,
    )
  }

  // --out fig.R: the same script the browser's "Export R script" downloads, off
  // the same fully-loaded view. Checked before renderToSvg because the two are
  // alternative emitters for one view, not a render plus a side effect —
  // rasterizing an SVG nobody asked for would just be slow.
  if (opts.emitR) {
    const script = await buildRScript(view)
    throwOnDisplayError(view.tracks)
    return script
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
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : dotplotInit(ctx.data, ctx.opts)
  const view = await addInitView<DotplotViewModel>(ctx, 'DotplotView', init)
  const svg = await renderDotplotToSvg(view, baseSvgOpts(ctx.opts))
  return svg
}

const renderSynteny: ModeRenderer = async ctx => {
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : syntenyInit(ctx.data, ctx.opts)
  const view = await addInitView<LinearSyntenyViewModel>(
    ctx,
    'LinearSyntenyView',
    init,
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
function circularTrackIds(model: Model, tracks: Track[], skip: TrackSkipper) {
  const { pluginManager } = getEnv(model)
  // A track with no plugin behind it reports itself, by name and reason — don't
  // also claim the circular view is the thing that can't draw it.
  const supported = viewDisplayNames(pluginManager, 'CircularView')
  const compatible = tracks.filter(track => {
    if (skip(track.trackId)) {
      return false
    }
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
function circularInit(ctx: ModeContext): CircularViewInit {
  return {
    assembly: ctx.data.assembly.name,
    tracks: circularTrackIds(ctx.model, ctx.data.tracks, ctx.skipTrack),
  }
}

const renderCircular: ModeRenderer = async ctx => {
  const init = ctx.spec ? initFromSpec(ctx.spec) : circularInit(ctx)
  const view = await addInitView<CircularViewModel>(ctx, 'CircularView', init)
  const svg = await renderCircularToSvg(view, baseSvgOpts(ctx.opts))
  return svg
}

// A window per locstring in --loc, stacked, with the reads that leave one and
// arrive in another drawn between them. Unlike the comparative modes this reads
// --track, because its panels are ordinary LGVs and the whole picture is the
// tracks on them: with no track there is nothing to connect and the export is a
// stack of empty rulers.
//
// The view's `init` is an ARRAY (one entry per panel), which is why this does
// not go through `initFromSpec` the way the single-init modes do — but it is the
// same `init` state machine underneath, so `addInitView`/`readyView` wait on it
// identically.
const renderBreakpoint: ModeRenderer = async ctx => {
  const { data, opts, model } = ctx
  // trackId AND its modifiers: breakpointTracks builds a display snapshot from
  // them, since a breakpoint panel opens its tracks from `init` and never
  // reaches the `applyDisplayOpts`/`showTrack` call every other mode uses
  const showTracks = (opts.showTracks ?? []).map(
    ([, [trackInput, ...trackOpts]]) => {
      if (!trackInput) {
        throw new Error(
          '--track requires a trackId (list them with "jb2export list <hub>")',
        )
      }
      return {
        trackId: resolveTrackId(data.tracks, trackInput, data.assembly.name),
        opts: trackOpts,
      }
    },
  )
  const init = ctx.spec
    ? breakpointInitFromSpec(ctx.spec)
    : breakpointInit(data, opts, showTracks)
  const view = await addInitView<BreakpointViewModel>(
    ctx,
    'BreakpointSplitView',
    init,
  )
  // A SECOND wait, because this view's `init` is consumed one level above the
  // one that matters. Its autorun turns the panel array into sub-views and
  // clears `init` in the same tick, so `readyView` is satisfied the moment the
  // panels EXIST — while each sub-view still carries its own `init` holding the
  // loc and, decisively, the tracks. Rendering there produced two correctly
  // positioned, correctly labelled, completely empty panels: the exact
  // failure `whenViewReady` warns about for LGV's `initPending`, one level of
  // nesting further out.
  await when(
    () =>
      view.views.every(v => !v.init) ||
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
// tracks from its own init (or --spec), so a --track/--refseq passed to one is
// dropped; --loc positions the sub-views of a comparative view but means nothing
// to a circular one, which always shows the whole assembly. main.ts warns about
// the reverse — comparative flags in a linear run — so say this here rather than
// leave the non-linear direction silent.
//
// Breakpoint is the one non-linear mode that DOES read --track: its panels are
// ordinary LGVs and the tracks on them are the whole picture.
export function warnLinearOnlyOptions(mode: ViewMode, opts: Opts) {
  if (mode === 'linear') {
    return
  }
  // Not a warning like the rest: R export is the whole point of the run, and
  // only the linear view has one. Falling back to SVG would write markup into a
  // file named .R, which fails later and somewhere else.
  if (opts.emitR) {
    throw new Error(
      `--out *.R exports the linear view's R script; a ${mode} view has no R export`,
    )
  }
  const ignored = [
    opts.showTracks?.length && mode !== 'breakpoint' ? '--track' : '',
    opts.refseq ? '--refseq' : '',
    mode === 'circular' && opts.loc ? '--loc' : '',
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
  // Parsed before the config is built: a spec's `sessionTracks` are track
  // configs the app would add to the session, and the view names them by
  // trackId, so they have to be in the config the model is created from.
  // Prepended, the same order the session publishes them in (session tracks
  // shadow a config track of the same id).
  const parsed = opts.spec ? parseSpec(opts.spec) : undefined
  const data = readData(opts, configObject ?? (await resolveConfigObject(opts)))
  if (parsed?.sessionTracks.length) {
    data.tracks = [...parsed.sessionTracks, ...data.tracks]
  }
  const model = createModel(data)
  // Set the theme on the session up front: worker-side label/feature colors
  // (e.g. gene-description blue) are baked at feature-fetch time from
  // session.themeOptions, which happens before renderToSvg applies themeName at
  // rasterization. Without this, a dark theme renders feature descriptions in
  // the light-theme dark blue, illegible on the dark track background.
  if (opts.themeName) {
    model.session.setThemeName(opts.themeName)
  }
  // Which of the config's tracks this build has no plugin for, asked off the
  // model's own type registries. Every path below that opens a track asks first,
  // so an unbuildable one costs its own lane instead of the whole figure.
  const { pluginManager } = getEnv(model)
  const skipTrack = trackSkipper(data.tracks, pluginManager)
  // A --spec names its tracks in the view's `init` snapshot, so the skip has to
  // reach in there too — dropping them from data.tracks instead would only turn
  // "invalid configuration" into `Could not resolve identifier`.
  const spec = parsed?.view
  if (spec) {
    spec.tracks = filterInitTracks(spec.tracks, skipTrack)
  }
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
      skipTrack,
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
