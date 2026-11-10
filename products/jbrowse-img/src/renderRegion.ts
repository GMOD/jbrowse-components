import { retainAdapterSession } from '@jbrowse/core/data_adapters/adapterSessionRefcount'
import { getEnv } from '@jbrowse/core/util'
import { openTracks } from '@jbrowse/core/util/openViews'
import {
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'
import { whenViewSettled } from '@jbrowse/core/util/whenViewSettled'
import {
  buildComparative,
  comparativeRole,
  hasComparativeArgs,
  resolveTrackId,
  trackType,
} from '@jbrowse/launch-args'
import {
  buildDisplaySnapshot,
  memberWrites,
} from '@jbrowse/launch-args/displaySettings'
import { destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg as renderBreakpointToSvg } from '@jbrowse/plugin-breakpoint-split-view'
import { renderToSvg as renderCircularToSvg } from '@jbrowse/plugin-circular-view'
import { renderToSvg as renderDotplotToSvg } from '@jbrowse/plugin-dotplot-view'
import { renderToSvg as renderSyntenyToSvg } from '@jbrowse/plugin-linear-comparative-view'
import {
  fetchResults,
  renderToSvg as renderLinearToSvg,
  openedDisplayType,
  writeFilter,
  writeMembers,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewStateAsync } from '@jbrowse/react-app2'
import { createCanvas, loadImage } from '@napi-rs/canvas'

import { applyDisplayOpts } from './applyTrackOpts.ts'
import { breakpointInit, breakpointPanelsFromSpec } from './breakpointInit.ts'
import { dotplotInit, syntenyInit } from './comparativeInit.ts'
import { readsJoiningRegions } from './joinedReads.ts'
import { modeDescriptors, subcommandForViewType } from './modes.ts'
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_WIDTH,
  optionsWithoutEffect,
} from './options.ts'
import { readData } from './readData.ts'
import { fetchHostedGenomes, resolveConfigObject } from './resolveHub.ts'
import {
  parseSpec,
  specMode,
  viewSettingsFromSpec,
  withViewSettings,
} from './spec.ts'

import type { ViewMode } from './modes.ts'
import type { ViewSpec } from './spec.ts'
import type { Config, ConfigFile, OpenTrack, Opts, Track } from './types.ts'
import type { ViewSnapshotInput } from '@jbrowse/core/PluginManager'
import type { AbstractViewModel, ViewProblem } from '@jbrowse/core/util'
import type { SettleableView } from '@jbrowse/core/util/whenViewSettled'
import type { Entry } from '@jbrowse/launch-args'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'
import type {
  BreakpointSplitViewInitView,
  BreakpointViewModel,
} from '@jbrowse/plugin-breakpoint-split-view'
import type {
  CircularViewCommands,
  CircularViewModel,
} from '@jbrowse/plugin-circular-view'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Drawing with no session was built and removed: the session costs 10–14 ms
// of a 55–640 ms render (ADR-262).
async function createModel(data: Config) {
  const model = await createViewStateAsync({
    config: {
      assemblies: data.assemblies,
      tracks: data.tracks,
      aggregateTextSearchAdapters: data.aggregateTextSearchAdapters,
      defaultSession: data.defaultSession as { name: string } | undefined,
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  return model
}

type Model = Awaited<ReturnType<typeof createModel>>

// Search first rather than rely on navToLocString's own search, which opens an
// interactive picker on multiple hits. Here the top hit wins.
async function navToLocOrGene(
  view: LinearGenomeViewModel,
  session: Model['session'],
  input: string,
  assembly: LoadedAssembly,
  hasSearchIndex: boolean,
) {
  const hit = hasSearchIndex
    ? (
        await fetchResults({
          queryString: input,
          searchType: 'exact',
          assemblyName: assembly.name,
          textSearchManager: session.textSearchManager,
          assembly,
        })
      ).find(r => r.hasLocation())
    : undefined
  await view.navToLocString(hit?.getLocation() ?? input, assembly.name)
}

type LoadedAssembly = NonNullable<
  Awaited<ReturnType<Model['session']['assemblyManager']['waitForAssembly']>>
>

// navToLocString swallows a failed assembly load, which then reads as an
// unknown refName.
async function loadAssembly(session: Model['session'], name: string) {
  const message = `Failed to load assembly "${name}" (sequence, regions or refName aliases)`
  const assembly = await session.assemblyManager
    .waitForAssembly(name)
    .catch((e: unknown) => {
      throw new Error(message, { cause: e })
    })
  if (!assembly) {
    throw new Error(message)
  }
  return assembly
}

interface ModeContext {
  model: Model
  data: Config
  opts: Opts
  width: number
  spec?: ViewSpec
}

/**
 * Counts are per alignments track in track order. `links` counts reads joining
 * panels or `joined` regions. `alt` is reads carrying `sortAllele` at `sortAt`
 * over reads spanning it. `spec` omits file-flag tracks, which no hosted config
 * has.
 */
export interface Rendered {
  svg: string
  links?: number[]
  alt?: string[]
  spec?: ViewSpec
}

type ModeRenderer = (ctx: ModeContext) => Promise<string | Rendered>

// jsdom's canvas draws nothing, so rasterized layers need a real one
const nodeCanvas = (w: number, h: number) =>
  createCanvas(w, h) as unknown as HTMLCanvasElement

const nodeSvgImage = async (markup: string) =>
  (await loadImage(Buffer.from(markup))) as unknown as CanvasImageSource

function baseSvgOpts(opts: Opts) {
  return {
    rasterizeLayers: !opts.noRasterize,
    themeName: opts.themeName,
    fontFamily: opts.fontFamily ?? DEFAULT_FONT_FAMILY,
    createCanvas: nodeCanvas,
    decodeSvg: nodeSvgImage,
  }
}

// assembly.error is checked too because CircularView never awaits its
// assembly, so a failed load is reported nowhere else and the view would hang.
interface RenderErrorSources {
  views: readonly { problems: readonly ViewProblem[] }[]
  assemblyManager: { assemblies: { error?: unknown }[] }
}

function firstRenderError(session: RenderErrorSources): unknown {
  const messages = session.views.flatMap(view =>
    view.problems.map(p => p.message),
  )
  return messages.length > 0
    ? messages.join('\n  ')
    : session.assemblyManager.assemblies.find(a => a.error)?.error
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

interface ConfigProblem {
  level: string
  mark?: number
  slot: string
  message: string
}

function configProblemsOf(display: object): readonly ConfigProblem[] {
  return 'configProblems' in display && Array.isArray(display.configProblems)
    ? display.configProblems
    : []
}

interface Skipped {
  skipped: number
  total: number
  fields: string[]
}

function skippedOf(display: object): Skipped | undefined {
  const value =
    'skippedFeatures' in display ? display.skippedFeatures : undefined
  return typeof value === 'object' &&
    value !== null &&
    'skipped' in value &&
    'total' in value
    ? (value as Skipped)
    : undefined
}

// The app reports skipped features only in a corner chip, which a PNG cannot
// open. An empty region is not a skip.
function skipLine(trackId: string, { skipped, total, fields }: Skipped) {
  const unreadable = fields.length
    ? `: nothing readable for ${fields.join(', ')}`
    : ''
  return skipped === total
    ? {
        level: 'error',
        line: `track "${trackId}" plotted none of its ${total} features${unreadable}`,
      }
    : {
        level: 'warning',
        line: `track "${trackId}" left ${skipped} of ${total} features out of the plot${unreadable}`,
      }
}

// Read off the display rather than the config, so the problems are those of
// the display type drawn after every modifier. Call once the render has
// settled or failed.
function reportConfigProblems(session: Model['session']) {
  const errors = new Set<string>()
  const warnings = new Set<string>()
  const found = ({ level, line }: { level: string; line: string }) => {
    ;(level === 'error' ? errors : warnings).add(line)
  }
  for (const track of openTracks(session)) {
    const { trackId } = track.configuration
    for (const display of track.displays) {
      for (const { level, mark, slot, message } of configProblemsOf(display)) {
        found({
          level,
          line: `track "${trackId}" ${mark === undefined ? '' : `mark ${mark} `}${slot}: ${message}`,
        })
      }
      const skipped = skippedOf(display)
      if (skipped && skipped.skipped > 0) {
        found(skipLine(trackId, skipped))
      }
    }
  }
  for (const line of warnings) {
    console.warn(`Warning: ${line}`)
  }
  if (errors.size > 0) {
    throw new Error(`cannot draw as configured:\n  ${[...errors].join('\n  ')}`)
  }
}

interface InitView extends SettleableView {
  setWidth: (n: number) => void
}

// Waits for the launch blob to clear, not `initPending`: LGV clears that once
// regions land, while tracks are still attaching. Deliberately unbounded; a
// timeout would only mislabel a stuck fetch.
async function whenViewReady(view: InitView, session: RenderErrorSources) {
  await whenViewSettled(view, () => firstRenderError(session) !== undefined)
  if (view.error !== undefined) {
    throw toError(view.error)
  }
  throwOnRenderError(session)
}

// A --spec is the user's unvalidated JSON, so it stays a loose record
type SpecSettings = Record<string, unknown>

// An adopted session view carries a persisted launch blob too, so it must be
// awaited just like a built one.
async function readyView<T extends InitView>(view: T, ctx: ModeContext) {
  view.setWidth(ctx.width)
  await whenViewReady(view, ctx.model.session)
  return view
}

function wrongViewTypeError(opts: Opts, suppliedType: string) {
  return new Error(
    `the ${opts.session ? '--session' : 'defaultSession'} holds a ${suppliedType}; render it with "jb2export ${subcommandForViewType(suppliedType) ?? '<subcommand>'}"`,
  )
}

function sequenceTrackId({ name, sequence }: Config['assembly']) {
  return typeof sequence.trackId === 'string'
    ? sequence.trackId
    : `${name}-ReferenceSequenceTrack`
}

// The sequence track lives on the assembly, not in `tracks`
function trackCandidates(data: Config): Track[] {
  return [
    ...data.tracks,
    { ...data.assembly.sequence, trackId: sequenceTrackId(data.assembly) },
  ]
}

function resolvedShowTracks(
  showTracks: Entry[] | undefined,
  data: Config,
): OpenTrack[] {
  const candidates = trackCandidates(data)
  return (showTracks ?? []).map(([, [trackInput, ...opts]]) => {
    if (!trackInput) {
      throw new Error(
        '--track requires a trackId (list them with "jb2export list <genome>")',
      )
    }
    return {
      trackId: resolveTrackId(candidates, trackInput, data.assembly.name),
      opts,
    }
  })
}

// Adopts the session's view if it is of this type, else builds one. `--spec`
// wins over the session. `makeSettings` is a thunk because building can throw
// on flags an adopted view makes irrelevant (breakpoint's two --loc).
async function addLaunchView<T extends InitView, N extends string>(
  ctx: ModeContext,
  viewType: N,
  makeSettings: () => ViewSnapshotInput<N>,
  settingsFromSpec: (spec: ViewSpec) => SpecSettings,
) {
  const { session } = ctx.model
  const suppliedType = ctx.spec ? undefined : session.views[0]?.type
  if (suppliedType !== undefined && suppliedType !== viewType) {
    throw wrongViewTypeError(ctx.opts, suppliedType)
  }
  const fixedBy = ctx.spec ? '--spec' : suppliedType ? 'the session' : undefined
  const named = namedTrackFlags(ctx.opts)
  if (fixedBy && viewType !== 'LinearGenomeView' && named.length > 0) {
    throw new Error(
      `${fixedBy} fixes the view's tracks, so ${named.join(', ')} would be dropped; put them in ${fixedBy === '--spec' ? 'the spec' : 'the session'}`,
    )
  }
  if (suppliedType === viewType && Object.keys(ctx.opts.view ?? {}).length) {
    throw new Error(
      'the session fixes the view, so --view would be dropped; put its settings in the session',
    )
  }
  const view: AbstractViewModel =
    suppliedType === viewType
      ? session.views[0]!
      : ctx.spec
        ? await session.launchView<string>(
            viewType,
            withViewSettings(settingsFromSpec(ctx.spec), ctx.opts.view),
          )
        : await session.launchView(
            viewType,
            withViewSettings(makeSettings(), ctx.opts.view),
          )
  // a view of type `viewType` is a `T`, which no type can say of a name
  return readyView(view as unknown as T, ctx)
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
    sortAt,
    highlight,
    joined,
  } = opts

  const { session } = model
  const flagTracks = resolvedShowTracks(showTracks, data)
  // the session's own launch is applied first, so `--loc` wins over it
  const view = await addLaunchView<LinearGenomeViewModel, 'LinearGenomeView'>(
    ctx,
    'LinearGenomeView',
    () => ({}),
    spec => ({ assembly: data.assembly.name, ...viewSettingsFromSpec(spec) }),
  )

  if (loc) {
    const assembly = await loadAssembly(session, data.assembly.name)
    if (loc === 'all') {
      view.showAllRegionsInAssembly(assembly.name)
    } else {
      await navToLocOrGene(
        view,
        session,
        loc,
        assembly,
        !!data.aggregateTextSearchAdapters?.length,
      )
    }
  } else if (!ctx.spec && !sessionParam && !defaultSession) {
    throw new Error(
      'No --loc specified (e.g. --loc chr1:1-10000 or --loc all). ' +
        'Alternatively pass --spec, --session or --defaultSession.',
    )
  } else if (!view.displayedRegions.length) {
    throw new Error(
      `the ${ctx.spec ? '--spec' : sessionParam ? '--session' : 'defaultSession'} has no view positioned on a region; pass --loc to say where to render`,
    )
  }

  if (refseq) {
    await view.launchTrack(sequenceTrackId(data.assembly))
  }
  if (highlight) {
    session.addHighlight({ ...highlight, assemblyName: data.assembly.name })
  }

  const toOpen = [...flagTracks, ...data.openTracks]
  const opened = []
  for (const { trackId, opts } of toOpen) {
    opened.push(
      await applyDisplayOpts(
        view,
        trackId,
        openedDisplayType(model.session, trackId, opts),
        opts,
        // the reads joining a row's windows take its top rows, and a column
        // sort would put every read at the column above them
        joined ? undefined : sortAt,
        joined,
      ),
    )
  }

  const svg = await renderLinearToSvg(view, {
    ...baseSvgOpts(opts),
    showGridlines,
    trackLabels,
  })
  return {
    svg,
    spec: loc
      ? {
          type: 'LinearGenomeView',
          assembly: data.assembly.name,
          loc,
          tracks: opened.slice(0, flagTracks.length),
          ...(highlight ? { highlight: [highlight] } : {}),
        }
      : undefined,
    links: joined
      ? view.tracks.flatMap(track => {
          const display = track.displays[0] as
            | Partial<LinearAlignmentsDisplayModel>
            | undefined
          return display?.crossRegionArcsByGroup
            ? [readsJoiningRegions(display.crossRegionArcsByGroup)]
            : []
        })
      : undefined,
    alt: sortAt
      ? view.tracks.flatMap(track => {
          const display = track.displays[0] as
            | Partial<LinearAlignmentsDisplayModel>
            | undefined
          // a track with no read here still takes its slot, so counts line up
          const at = display?.nonReferenceAt?.(sortAt, opts.sortAllele)
          return display && 'nonReferenceAt' in display
            ? [`${at?.count ?? 0}/${at?.depth ?? 0}`]
            : []
        })
      : undefined,
  }
}

const renderDotplot: ModeRenderer = async ctx => {
  const view = await addLaunchView<DotplotViewModel, 'DotplotView'>(
    ctx,
    'DotplotView',
    () => dotplotInit(ctx.data),
    viewSettingsFromSpec,
  )
  return renderDotplotToSvg(view, baseSvgOpts(ctx.opts))
}

const renderSynteny: ModeRenderer = async ctx => {
  const view = await addLaunchView<LinearSyntenyViewModel, 'LinearSyntenyView'>(
    ctx,
    'LinearSyntenyView',
    () => syntenyInit(ctx.data),
    viewSettingsFromSpec,
  )
  return renderSyntenyToSvg(view, {
    ...baseSvgOpts(ctx.opts),
    trackLabels: ctx.opts.trackLabels,
    showGridlines: ctx.opts.showGridlines,
  })
}

// showTrack throws on a track with no circular display, aborting the render
function circularDrawable(
  model: Model,
  tracks: Track[],
  open: OpenTrack[],
): OpenTrack[] {
  const { pluginManager } = getEnv(model)
  const supported = viewDisplayNames(pluginManager, 'CircularView')
  return open.filter(({ trackId }) => {
    const track = tracks.find(t => t.trackId === trackId) ?? { trackId }
    const type = trackType(track)
    // the type may come from a plugin this bundle does not register
    const ok = viewCanDisplayTrack(pluginManager, supported, {
      type,
      adapter: track.adapter,
    })
    if (!ok) {
      console.warn(
        `Warning: skipping track "${trackId}" (${type}) — it has no display the circular view can render`,
      )
    }
    return ok
  })
}

// With no track named, every config track opens. Modifiers are not applied:
// they name linear display slots, and an undeclared key fails the export.
function circularInit(ctx: ModeContext): CircularViewCommands {
  const { model, data, opts } = ctx
  const named = [
    ...resolvedShowTracks(opts.showTracks, data),
    ...data.openTracks,
  ]
  const open = named.length
    ? named
    : data.tracks.map(({ trackId }) => ({ trackId, opts: [] }))
  const drawable = circularDrawable(model, trackCandidates(data), open)
  const modified = drawable.filter(({ opts: mods }) => mods.length > 0)
  if (modified.length > 0) {
    console.warn(
      `Warning: display modifiers on ${modified.map(({ trackId }) => `"${trackId}"`).join(', ')} have no effect on a circular view`,
    )
  }
  return {
    assembly: data.assembly.name,
    tracks: drawable.map(({ trackId }) => trackId),
  }
}

const renderCircular: ModeRenderer = async ctx => {
  const view = await addLaunchView<CircularViewModel, 'CircularView'>(
    ctx,
    'CircularView',
    () => circularInit(ctx),
    viewSettingsFromSpec,
  )
  return renderCircularToSvg(view, baseSvgOpts(ctx.opts))
}

// Filter and member writes cannot ride a panel's launch blob, so they are
// applied once each panel has opened.
const renderBreakpoint: ModeRenderer = async ctx => {
  const { data, opts, model } = ctx
  let flagTracks: OpenTrack[] = []
  let specPanels: BreakpointSplitViewInitView[] | undefined
  const view = await addLaunchView<BreakpointViewModel, 'BreakpointSplitView'>(
    ctx,
    'BreakpointSplitView',
    () => {
      const showTracks = resolvedShowTracks(opts.showTracks, data)
      flagTracks = [...showTracks, ...data.openTracks]
      const panels = (from: Config) =>
        breakpointInit(from, opts, showTracks, (trackId, modifiers) =>
          openedDisplayType(model.session, trackId, modifiers),
        )
      specPanels = panels({ ...data, openTracks: [] })
      return { views: panels(data) }
    },
    spec => ({ views: breakpointPanelsFromSpec(spec) }),
  )
  const drawnFilters = new Map<string, unknown[]>()
  // the view's launch clears before each panel's own launch has run
  for (const panel of view.views) {
    await whenViewReady(panel, model.session)
    for (const { trackId, opts: modifiers } of flagTracks) {
      const displayType = openedDisplayType(model.session, trackId, modifiers)
      const drawn = writeFilter(
        panel,
        trackId,
        buildDisplaySnapshot(displayType, modifiers, () => {}),
      )
      if (drawn) {
        drawnFilters.set(trackId, drawn)
      }
      writeMembers(panel, trackId, memberWrites(displayType, modifiers))
    }
  }
  const spec: ViewSpec | undefined = specPanels && {
    type: 'BreakpointSplitView',
    views: specPanels.map(panel => ({
      ...panel,
      tracks: panel.tracks?.map(t =>
        typeof t !== 'string' && drawnFilters.has(t.trackId)
          ? { ...t, filter: drawnFilters.get(t.trackId) }
          : t,
      ),
    })),
  }
  const svg = await renderBreakpointToSvg(view, {
    ...baseSvgOpts(opts),
    trackLabels: opts.trackLabels,
    showGridlines: opts.showGridlines,
  })
  return {
    svg,
    spec,
    links: [...view.overlayMatches.values()].flatMap(match =>
      match.kind === 'alignment'
        ? [
            match.chains.filter(({ connections }) =>
              connections.some(
                ({ e1, e2 }) =>
                  (e1.level !== e2.level ||
                    e1.displayedRegionIndex !== e2.displayedRegionIndex) &&
                  match.layouts.has(e1) &&
                  match.layouts.has(e2),
              ),
            ).length,
          ]
        : [],
    ),
  }
}

function fileTrackFlags({ trackList }: Opts) {
  return [
    ...new Set(
      (trackList ?? [])
        .filter(entry => !comparativeRole(entry))
        .map(([type]) => type),
    ),
  ].map(type => `--${type}`)
}

function namedTrackFlags(opts: Opts) {
  return [
    ...(opts.showTracks?.length ? ['--track'] : []),
    ...fileTrackFlags(opts),
  ]
}

function givenOptions(opts: Opts) {
  return Object.entries({
    ...opts,
    track: opts.showTracks?.length ? true : undefined,
  })
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name]) => name)
}

// A comparative view's levels are its synteny files, so another file flag draws
// nowhere
function warnOptionsWithoutEffect(mode: ViewMode, opts: Opts) {
  const ignored = [
    ...optionsWithoutEffect(mode, givenOptions(opts)).map(name => `--${name}`),
    ...(modeDescriptors[mode].comparative ? fileTrackFlags(opts) : []),
  ]
  if (ignored.length) {
    console.warn(
      `Warning: ${ignored.join(', ')} ${ignored.length > 1 ? 'have' : 'has'} no effect on a ${mode} view`,
    )
  }
}

// A subcommand and a --spec must agree. With neither, a second genome or a
// comparison file means synteny, as Desktop opens the same command line.
export function resolveMode(
  mode: ViewMode | undefined,
  spec: ViewSpec | undefined,
  comparative = false,
) {
  const specsMode = spec && specMode(spec)
  if (spec && specsMode && mode !== undefined && mode !== specsMode) {
    throw new Error(
      `--spec describes a ${spec.type}; render it with "jb2export ${modeDescriptors[specsMode].subcommand}" (not "jb2export ${modeDescriptors[mode].subcommand}")`,
    )
  }
  const resolved = specsMode ?? mode ?? (comparative ? 'synteny' : 'linear')
  if (resolved === 'linear' && comparative) {
    throw new Error(
      `a linear view opens one genome, and this command line has a second genome or a comparison file; ${spec ? 'drop them, or pass a spec of a synteny view' : 'drop "lgv" to render a synteny view'}`,
    )
  }
  return resolved
}

const modeRenderers: Record<ViewMode, ModeRenderer> = {
  linear: renderLinear,
  dotplot: renderDotplot,
  synteny: renderSynteny,
  circular: renderCircular,
  breakpoint: renderBreakpoint,
}

/** `configObject` is a config a batch fetched once for every record. */
export async function renderRegion(opts: Opts, configObject?: ConfigFile) {
  const { svg } = await renderRegionReport(opts, configObject)
  return svg
}

export async function renderRegionReport(
  opts: Opts,
  configObject?: ConfigFile,
): Promise<Rendered> {
  const argv = opts.argv ?? []
  const spec = opts.spec ? parseSpec(opts.spec) : undefined
  const mode = resolveMode(opts.mode, spec, hasComparativeArgs(argv))
  const specAssembly =
    mode === 'linear' && typeof spec?.assembly === 'string'
      ? spec.assembly
      : undefined
  const data = readData(
    { ...opts, assembly: opts.assembly ?? specAssembly },
    configObject ?? (await resolveConfigObject(opts)),
    await fetchHostedGenomes(
      hasComparativeArgs(argv) ? buildComparative(argv).hosted : [],
    ),
  )
  warnOptionsWithoutEffect(mode, opts)
  const model = await createModel(data)
  // feature colors are baked at fetch time from the session theme, before
  // renderToSvg applies themeName
  if (opts.themeName) {
    model.session.setThemeName(opts.themeName)
  }
  if (opts.themeMode) {
    model.session.setThemeMode(opts.themeMode)
  }
  try {
    const rendered = await modeRenderers[mode]({
      model,
      data,
      opts,
      width: opts.width ?? DEFAULT_WIDTH,
      spec,
    }).then(
      result => ({ result }),
      (error: unknown) => ({ error }),
    )
    reportConfigProblems(model.session)
    if ('error' in rendered) {
      throw rendered.error
    }
    const { result } = rendered
    throwOnRenderError(model.session)
    return typeof result === 'string' ? { svg: result } : result
  } finally {
    // a fast-failing render leaves assembly loads in flight, whose adapters
    // read the assembly config after it dies unless they finish first
    await Promise.allSettled(
      model.session.assemblyManager.assemblies.flatMap(a =>
        a.loadingP ? [a.loadingP] : [],
      ),
    )
    if (opts.keepAdapters) {
      // an unreleased claim keeps the adapter cached for the next record
      for (const track of openTracks(model.session)) {
        if ('rpcSessionId' in track && typeof track.rpcSessionId === 'string') {
          retainAdapterSession(model.session.rpcManager, track.rpcSessionId)
        }
      }
    }
    destroy(model)
  }
}
