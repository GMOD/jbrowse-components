import fs from 'fs'
import path from 'path'

import { destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg as renderCircularToSvg } from '@jbrowse/plugin-circular-view'
import { renderToSvg as renderDotplotToSvg } from '@jbrowse/plugin-dotplot-view'
import { renderToSvg as renderSyntenyToSvg } from '@jbrowse/plugin-linear-comparative-view'
import { renderToSvg as renderLinearToSvg } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-app2'
import { createCanvas } from 'canvas'
import { when } from 'mobx'

import { readData } from './readData.ts'
import { booleanize } from './util.ts'

import type { Entry } from './parseArgv.ts'
import type { Config, Opts, ViewMode } from './readData.ts'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function applyTrackOpts(trackEntry: Entry, view: LinearGenomeViewModel) {
  const [, [track, ...opts]] = trackEntry
  if (!track) {
    throw new Error('invalid command line args')
  }
  const currentTrack = view.showTrack(path.basename(track))
  const display = currentTrack.displays[0]
  for (const opt of opts) {
    const [prefix, val1 = '', val2] = opt.split(':')
    switch (prefix) {
      case 'height': {
        if (val1) {
          display.setHeight(+val1)
        }
        break
      }
      case 'sort': {
        display.setSortedBy?.(val1, val2)
        break
      }
      case 'color': {
        if (display.setColorScheme) {
          display.setColorScheme({ type: val1, tag: val2 })
        } else {
          display.setColor?.(val1)
        }
        break
      }
      // 'off' | 'up' | 'down' | 'samplot' — paired-end connections. Mode and
      // direction are separate model fields; translate the legacy flag value.
      case 'arcs': {
        if (val1 === 'samplot') {
          display.setReadConnections?.('samplot')
        } else if (val1 === 'up' || val1 === 'down') {
          display.setReadConnections?.('arc')
          display.setReadConnectionsDown?.(val1 === 'down')
        } else {
          display.setReadConnections?.('off')
        }
        break
      }
      // 'off' | 'normal' | 'bezier' — 10x/linked-read chain overlay
      case 'linkedReads': {
        display.setLinkedReads?.(val1)
        break
      }
      // 'off' | 'up' | 'down' — splice-junction arcs
      case 'sashimi': {
        display.setSashimiArcs?.(val1)
        break
      }
      case 'coverage': {
        display.setShowCoverage?.(booleanize(val1 || 'true'))
        break
      }
      case 'coverageHeight': {
        if (val1) {
          display.setCoverageHeight?.(+val1)
        }
        break
      }
      case 'readConnectionsHeight': {
        if (val1) {
          display.setReadConnectionsHeight?.(+val1)
        }
        break
      }
      case 'readConnectionsLineWidth': {
        if (val1) {
          display.setReadConnectionsLineWidth?.(+val1)
        }
        break
      }
      case 'featureHeight': {
        if (
          val1 === 'normal' ||
          val1 === 'compact' ||
          val1 === 'super-compact'
        ) {
          // setCompactness is the authoritative cross-display API (alignments,
          // basic features, comparative views all implement it)
          display.setCompactness?.(val1)
        } else if (val1) {
          const n = +val1
          if (isNaN(n)) {
            throw new Error(
              `Invalid featureHeight "${val1}". Use normal, compact, super-compact, or a number.`,
            )
          }
          display.setFeatureHeight?.(n)
        }
        break
      }
      case 'featureSpacing': {
        if (val1) {
          display.setFeatureSpacing?.(+val1)
        }
        break
      }
      case 'noSpacing': {
        // Legacy boolean: true → 0px spacing, false → 2px spacing (the value
        // the pre-unification override branch baked in for noSpacing=false).
        display.setFeatureSpacing?.(booleanize(val1 || 'true') ? 0 : 2)
        break
      }
      case 'softClipping': {
        if (booleanize(val1 || 'true') !== display.showSoftClipping) {
          display.toggleSoftClipping?.()
        }
        break
      }
      case 'force': {
        if (booleanize(val1 || 'true')) {
          display.setFeatureDensityStatsLimit({ bytes: Number.MAX_VALUE })
        }
        break
      }
      case 'autoscale': {
        display.setAutoscale(val1)
        break
      }
      case 'minmax': {
        if (val1) {
          display.setMinScore(+val1)
        }
        if (val2) {
          display.setMaxScore(+val2)
        }
        break
      }
      case 'scaletype': {
        display.setScaleType(val1)
        break
      }
      case 'crosshatch': {
        display.setCrossHatches(booleanize(val1 || 'true'))
        break
      }
      case 'fill': {
        display.setFill(booleanize(val1 || 'true'))
        break
      }
      case 'resolution': {
        const val =
          val1 === 'fine' ? 10 : val1 === 'superfine' ? 100 : Number(val1)
        display.setResolution(Number.isNaN(val) ? 1 : val)
        break
      }
    }
  }
  // snpcov is a "show only coverage" pseudo-mode. The unified
  // LinearAlignmentsDisplay has no explicit coverage-only flag — pileup
  // viewport height = display.height - coverageHeight, so we make coverage
  // fill the whole track. Done after the main loop so the user's height: or
  // coverageHeight: settings flow through first.
  if (opts.includes('snpcov') && display.setCoverageHeight && display.height) {
    display.setShowCoverage?.(true)
    display.setCoverageHeight(display.height)
  }
}

// react-app2 hosts every view type and accepts multiple assemblies, where the
// LGV-only react2 host could not. RPC runs on the main thread (the rpc
// defaultDriver default), so no worker is needed for headless export.
function createModel(data: Config) {
  return createViewState({
    config: {
      assemblies: data.assemblies,
      tracks: data.tracks,
      defaultSession: data.defaultSession as { name: string } | undefined,
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
}

type Model = ReturnType<typeof createModel>

// A parsed --spec view object: the same shape as a web session-spec view (see
// urlparams.md). `type` selects the render mode; the remaining fields ARE the
// view's `init` snapshot (sub-views + level-indexed tracks for comparative
// views), so they pass straight to addInitView.
interface ViewSpec {
  type: string
  [key: string]: unknown
}

// Accepts the documented `{ views: [viewObject] }` wrapper (so JSON copied from
// a `&session=spec-` URL works) or a bare view object. Reads from a file when
// `spec` is a path, else parses it as inline JSON.
function parseSpec(spec: string): ViewSpec {
  const raw = fs.existsSync(spec) ? fs.readFileSync(spec, 'utf8') : spec
  const obj = JSON.parse(raw) as Record<string, unknown>
  const view =
    typeof obj.type === 'string'
      ? obj
      : Array.isArray(obj.views)
        ? (obj.views[0] as Record<string, unknown> | undefined)
        : undefined
  if (!view || typeof view.type !== 'string') {
    throw new Error(
      '--spec JSON must be a view object (or a { views: [...] } wrapper) with a "type" field',
    )
  }
  return view as ViewSpec
}

const specTypeToMode: Record<string, ViewMode> = {
  LinearSyntenyView: 'synteny',
  DotplotView: 'dotplot',
  CircularView: 'circular',
}

function specMode(spec: ViewSpec): ViewMode {
  const mode = specTypeToMode[spec.type]
  if (!mode) {
    throw new Error(
      `unsupported view type in --spec: ${spec.type} (supported: ${Object.keys(specTypeToMode).join(', ')})`,
    )
  }
  return mode
}

// The view-init snapshot a comparative renderer feeds to addInitView: the spec
// minus its `type` discriminator.
function initFromSpec({ type, ...init }: ViewSpec) {
  return init
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

// A comparative/circular view sets `initialized` true as soon as it has regions
// to show, but its frozen `init` snapshot is consumed a moment later by an async
// autorun (which awaits assemblies, navigates each sub-view, and attaches
// tracks). The SVG only has content once that autorun has run to completion and
// cleared `init`.
function whenViewReady(view: { initialized: boolean; init?: unknown }) {
  return when(() => view.initialized && !view.init)
}

interface InitView {
  setWidth: (n: number) => void
  initialized: boolean
  init?: unknown
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
  await whenViewReady(view)
  return view
}

const renderLinear: ModeRenderer = async ({ model, data, opts, width }) => {
  const {
    loc,
    trackList = [],
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
// --fasta/--assembly is the query (top in synteny, x-axis in dotplot).
// Comparative views render adjacent assembly pairs as stacked levels, so this
// supports an arbitrary number of assemblies (a-vs-b is the common case). The
// CLI exposes --loc/--loc2 for the first two; any further assembly shows its
// whole genome.
function comparativeViews({ data, opts }: ModeContext) {
  const { assemblies } = data
  if (assemblies.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (--fasta + --fasta2, or --assembly + --assembly2)',
    )
  }
  const locs = [opts.loc, opts.loc2]
  return assemblies.map((asm, i) =>
    locs[i] ? { assembly: asm.name, loc: locs[i] } : { assembly: asm.name },
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
    : { views: comparativeViews(ctx).slice(0, 2), tracks }
  const view = await addInitView<DotplotViewModel>(ctx, 'DotplotView', init)
  return renderDotplotToSvg(view, {
    rasterizeLayers: !ctx.opts.noRasterize,
    themeName: ctx.opts.themeName,
  })
}

const renderSynteny: ModeRenderer = async ctx => {
  const init = ctx.spec
    ? initFromSpec(ctx.spec)
    : { views: comparativeViews(ctx), tracks: syntenyTrackLevels(ctx.data) }
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
  const data = readData(opts)
  const model = createModel(data)
  const spec = opts.spec ? parseSpec(opts.spec) : undefined
  // an explicit subcommand wins; otherwise a --spec selects its mode from the
  // view type, falling back to the default linear view
  const mode = opts.mode ?? (spec ? specMode(spec) : 'linear')
  try {
    return await modeRenderers[mode]({
      model,
      data,
      opts,
      width: opts.width ?? 1500,
      spec,
    })
  } finally {
    destroy(model)
  }
}
