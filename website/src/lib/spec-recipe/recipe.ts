import { deriveAddTrack, deriveAddTrackJson } from '../derive-add-track.ts'
import {
  defaultDisplay,
  fileKind,
  lookupAssembly,
  lookupTrack,
  rowViewType,
} from './configs.ts'
import { takeArrangement } from './arrangements.ts'
import { agentBrief, captureFrame } from './agent.ts'
import { configTracks } from './configTracks.ts'
import { imgRecipe } from './img.ts'
import { figureFrames, videoFrames } from '../liveLinks.generated.ts'

import type { RawTrack, TrackInfo  } from './configs.ts'
import {
  decodeSpecUrl,
  openedTrackIds,
  specDisplayType,
  specTrackId,
  specTrackSettings,
  specTracks,
  viewSettingEntries,
} from './decode.ts'
import {
  IGNORED_FIELDS,
  launchFields,
  trackFields,
  viewFields,
} from './fields.ts'
import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { toProtocolUrl } from '../../../../products/jbrowse-desktop/electron/launchTarget.ts'

import type { SessionSpec, SpecTrackEntry, SpecView } from './decode.ts'
import type { AgentRecipe } from './agent.ts'
import type { FieldContext, FieldRecipe } from './fields.ts'
import type { ImgRecipe } from './img.ts'

// Turns a figure's session spec into an ordered "do this yourself" recipe.
//
// The recipe is written for someone bringing their own file: each step names the
// action and the menu, and carries the figure's value only as a worked example.
// Steps come from the spec that produced the figure, so they describe the
// picture above them and not an idealized workflow.

export interface RecipeStep {
  title: string
  // the figure's own value for this step, shown as the concrete example
  example?: string
  note?: string
  // the steps taken inside this one: a track's settings under the step that
  // adds it, a row's or a pane's steps under its name
  substeps?: RecipeStep[]
  // this step is what opens its view (see FieldStep.opensView)
  opensView?: boolean
}

export interface Recipe {
  liveUrl: string
  // liveUrl renamed for Desktop, where the session name is persisted rather
  // than throwaway (see withSessionName). This is what a reader pastes.
  desktopWebUrl: string
  // desktopWebUrl as a jbrowse:// link, which an installed JBrowse Desktop
  // opens directly
  desktopUrl: string
  config: string
  configUrl: string
  specJson: string
  steps: RecipeStep[]
  // absent when a view needs a plugin the widget cannot load from the config
  python?: string
  // a prompt handing a coding agent this view, and the `npx @jbrowse/capture`
  // invocation that rebuilds the figure
  agent: AgentRecipe
  // the @jbrowse/img command drawing a one-view figure without a browser
  img?: ImgRecipe
  // the figure's own tracks as jbrowse CLI commands, for a reader putting them
  // in a config.json instead of in one session. Absent when the figure adds no
  // track of its own (every track comes from the config it loads).
  cli?: CliRecipe
  // spec fields with no verified click-path yet (surfaced by check-spec-recipes)
  unmapped: string[]
}

// The views a reader opens through a comparative import form. Rows (or axes)
// and the dataset between each pair are picked in that one form and launched
// together, so a five-row figure is a form to fill in — not five "open a
// genome" steps and one "open a track" step per band, all naming the same file,
// which is what walking the spec's shape produces and no version of the app has
// ever asked for.
interface ImportFormView {
  // what the Add menu calls it
  menu: string
  // the figure's own assemblies, in the order the form takes them
  assemblies: (names: string[]) => string
  // where a band's dataset is chosen in the manual form
  band: string
  // the form's assembly controls, which are also what Quick start fills in
  rowsControl: string
  // names one row for the steps that belong to it
  rowLabel: (index: number) => string
}

const IMPORT_FORM_VIEWS: Record<string, ImportFormView> = {
  LinearSyntenyView: {
    menu: 'Linear synteny view',
    assemblies: names =>
      `This figure's rows, top to bottom: ${names.join(', ')}.`,
    band: 'click the arrow between two rows',
    rowsControl: 'the rows',
    rowLabel: index => `Row ${index + 1}`,
  },
  DotplotView: {
    menu: 'Dotplot view',
    assemblies: names =>
      names.length > 1
        ? `This figure has ${names[0]} on X and ${names[1]} on Y.`
        : `This figure uses ${names[0]}.`,
    band: 'use the track panel under the two axis selectors',
    rowsControl: 'both axes',
    rowLabel: index => (index === 0 ? 'X axis' : 'Y axis'),
  },
}

// Labels that name what a track holds read naturally only if the noun matches
// the track ('Fixed read height' for a pileup, 'Fixed feature height' otherwise).
//
// The DISPLAY settles this where the track config cannot. A hosted config is
// not readable at build time, so `lookupTrack` returns nothing for most figures
// on this site and the track type is unavailable — which used to leave every
// one of them on the 'feature' fallback, and told a reader to open "Feature
// height" on a pileup whose menu says "Read height". The alignments display
// passes 'read' at its own call site (its model.ts) and the feature displays
// pass 'feature' (trackMenus.ts), so naming either one answers it outright.
// LGVSyntenyDisplay takes the noun from its own `featureNoun`, which is a
// config slot, so it stays with the track-type reading.
const DISPLAY_NOUNS: Record<string, string> = {
  LinearAlignmentsDisplay: 'read',
  LinearBasicDisplay: 'feature',
}

function trackNoun(trackType: string | undefined, displayType?: string): string {
  return (
    (displayType ? DISPLAY_NOUNS[displayType] : undefined) ??
    (trackType === 'AlignmentsTrack' ? 'read' : 'feature')
  )
}

// Walks a set of spec fields, skipping the ones that describe the figure rather
// than a setting, and turns each mapped field into a step (or records it as
// unmapped). Shared by tracks and views so both surface the same fields —
// including a mapper that returns undefined on an unexpected value shape.
function fieldSteps(
  entries: [string, unknown][],
  table: Record<string, FieldRecipe>,
  context: FieldContext,
) {
  const steps: RecipeStep[] = []
  const unmapped: string[] = []
  const settings = Object.fromEntries(entries)
  for (const [field, value] of entries) {
    if (IGNORED_FIELDS.has(field)) {
      continue
    }
    const produced = table[field]?.(value, { ...context, settings })
    const found = produced ? [produced].flat() : []
    for (const step of found) {
      steps.push({
        title: step.path,
        note: step.note,
        opensView: step.opensView,
      })
    }
    if (!produced) {
      unmapped.push(field)
    }
  }
  return { steps, unmapped }
}

function groupSteps(label: string, steps: RecipeStep[]): RecipeStep[] {
  return steps.length ? [{ title: label, substeps: steps }] : []
}

// What the Add menu calls each view, for a figure whose spec holds more than
// one. The fallback splits the type name (GraphGenomeView → "Graph genome
// view"), which is the label for every view type registered under its own name;
// the entries are the ones whose menu label is not that.
const VIEW_NAMES: Record<string, string> = {
  SvInspectorView: 'SV inspector',
  MsaView: 'Multiple sequence alignment view',
}

function viewName(type: string | undefined): string {
  if (!type) {
    return 'view'
  }
  const split = type.replaceAll(/(?<=[a-z])(?=[A-Z])/g, ' ')
  return VIEW_NAMES[type] ?? split[0] + split.slice(1).toLowerCase()
}

// A band's dataset in a comparative import form, rather than a track added to a
// view that is already open.
interface BandContext {
  form: ImportFormView
  // the bands this one entry covers, when it covers more than one — an
  // all-vs-all file is the same file in every band, which is the fact worth
  // saying. One band needs no count at all.
  bands: number
}

// **File → Open track...** adds to `session.views[0]` and says so in a
// notification (MULTI_VIEW_WARNING in product-core's menuItems). Any track that
// belongs somewhere else — a second pane, a row of a synteny view — is added
// from that view's own track selector, which is the app's own advice.
const OPEN_TRACK =
  'Add your track: **File → Open track...**, or check it in the track selector.'
const ADD_TRACK =
  "Add your track: **+** → **Add track** in this view's track selector, or check it there."

const NEXT_TRACK = 'Add the next track the same way.'

function addTrackTitle(
  info: TrackInfo | undefined,
  kind: string | undefined,
  band: BandContext | undefined,
  viaTrackSelector: boolean | undefined,
  repeat: boolean | undefined,
) {
  const needs = kind ? ` Needs ${kind}.` : ''
  return info?.type === 'ReferenceSequenceTrack'
    ? `Show the sequence: check **${info.name}** in the track selector.`
    : band
      ? `Add your file: ${band.form.band} and choose **New track**.${needs}`
      : `${repeat ? NEXT_TRACK : viaTrackSelector ? ADD_TRACK : OPEN_TRACK}${needs}`
}

function trackStep(
  entry: SpecTrackEntry,
  config: string,
  // the view type the track opens in
  viewType: string | undefined,
  sessionTracks?: RawTrack[],
  band?: BandContext,
  viaTrackSelector?: boolean,
  // an earlier step of this view already said how a track is added
  repeat?: boolean,
): RecipeStep & { unmapped: string[] } {
  const trackId = specTrackId(entry)
  const info = lookupTrack(config, trackId, sessionTracks)
  const kind = info ? fileKind(info.adapterType) : undefined
  const displayType =
    specDisplayType(entry) ??
    (viewType ? defaultDisplay(info, viewType) : undefined)
  const context: FieldContext = {
    noun: trackNoun(info?.type, displayType),
    displayType,
  }
  // An arrangement first, and the per-field walk over what it did not claim:
  // the settings one menu row writes together are one step, not one step each.
  const arrangement = takeArrangement(specTrackSettings(entry), displayType)
  const { steps: settings, unmapped } = fieldSteps(
    arrangement.rest,
    trackFields,
    context,
  )
  if (arrangement.step) {
    settings.unshift({ title: arrangement.step.path })
  }
  const name = info ? `“${info.name}”` : `the “${trackId}” track`
  return {
    title: addTrackTitle(info, kind, band, viaTrackSelector, repeat),
    example:
      info?.type === 'ReferenceSequenceTrack'
        ? undefined
        : band && band.bands > 1
          ? `This figure uses ${name} for ${band.bands === 2 ? 'both bands' : `all ${band.bands} bands`}.`
          : `This figure uses ${name}.`,
    ...(settings.length ? { substeps: settings } : {}),
    unmapped,
  }
}

// Everything the import form does, in the order it does it: the rows come from
// assemblies the session already has, each band gets a dataset, and one Launch
// opens the view.
function importFormSteps(
  view: SpecView,
  form: ImportFormView,
  config: string,
  sessionTracks?: RawTrack[],
): { steps: RecipeStep[]; unmapped: string[] } {
  const steps: RecipeStep[] = []
  const unmapped: string[] = []
  const assemblies = (view.views ?? [])
    .map(row => row.assembly)
    .filter(name => name !== undefined)
  if (assemblies.length) {
    steps.push({
      title:
        'Open your genomes: **Open new genome** in JBrowse Desktop, then **File → Open genome...** for each of the rest, or `jbrowse add-assembly` for each in JBrowse Web.',
      example: form.assemblies(assemblies),
    })
  }
  steps.push({
    title: assemblies.length
      ? `Open the view: **Add → ${form.menu}**, and set ${form.rowsControl} to those assemblies in the import form.`
      : `Open the view: **Add → ${form.menu}**, and choose ${form.rowsControl} in the import form.`,
    opensView: true,
  })

  // The bands of an all-vs-all figure carry the same entry, and that is one
  // file to open, so identical entries collapse to one step. Two bands that
  // really do differ still get a step each.
  const entries = specTracks(view)
  const distinct = [
    ...new Map(entries.map(entry => [JSON.stringify(entry), entry])).values(),
  ]
  for (const [index, entry] of distinct.entries()) {
    const { unmapped: trackUnmapped, ...step } = trackStep(
      entry,
      config,
      view.type,
      sessionTracks,
      { form, bands: distinct.length === 1 ? entries.length : 0 },
    )
    steps.push(
      index === 0
        ? {
            ...step,
            note: `Or pick a synteny track you already have under **Quick start**, which fills in ${form.rowsControl}.`,
          }
        : step,
    )
    unmapped.push(...trackUnmapped)
  }

  // A figure OF the empty import form names neither assemblies nor tracks, and
  // it is the form itself that the picture shows — launching is the step after
  // the one it illustrates.
  if (assemblies.length || entries.length) {
    const launch = fieldSteps(
      Object.entries(view).filter(([field]) => field in launchFields),
      launchFields,
      { noun: 'feature', viewType: view.type },
    )
    steps.push(...launch.steps, { title: 'Click **Launch**.' })
    unmapped.push(...launch.unmapped)
  }
  return { steps, unmapped }
}

const PYTHON_LITERALS: Record<string, string> = {
  true: 'True',
  false: 'False',
  null: 'None',
}

function pythonLiteral(value: unknown, indent: string) {
  return JSON.stringify(value, null, 4)
    .replaceAll(/"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b/g, token =>
      token.startsWith('"') ? token : PYTHON_LITERALS[token]!,
    )
    .replaceAll('\n', `\n${indent}`)
}

// A config's plugins are UMD builds or relative ESM paths, and neither the
// notebook widget nor jbrowse-img loads them, so a figure needing one gets
// neither snippet.
function needsPlugin(config: string, spec: SessionSpec) {
  const views = spec.views ?? []
  const sessionTracks = spec.sessionTracks as RawTrack[] | undefined
  return (
    views.some(view => !view.type || !(view.type in configManifest.views)) ||
    views.flatMap(openedTrackIds).some(trackId => {
      const info = lookupTrack(config, trackId, sessionTracks)
      return (
        info !== undefined &&
        !(
          info.type in configManifest.tracks &&
          info.adapterType in configManifest.adapters
        )
      )
    })
  )
}

function pythonSnippet(configUrl: string, spec: SessionSpec) {
  const views = spec.views ?? []
  const tracks = spec.sessionTracks?.length
    ? `config.get("tracks", []) + ${pythonLiteral(spec.sessionTracks, '    ')}`
    : 'config.get("tracks", [])'
  return [
    'from jbrowse_anywidget import JBrowseApp, fetch_hub',
    '',
    `config = fetch_hub("${configUrl}")`,
    'app = JBrowseApp(',
    '    assemblies=config["assemblies"],',
    `    tracks=${tracks},`,
    `    views=${pythonLiteral(views, '    ')},`,
    ')',
    'app  # display the widget',
  ].join('\n')
}

function viewSteps(
  view: SpecView,
  config: string,
  // tracks the spec declares inline, which is where a figure on a hosted config
  // gets its track types from (see lookupTrack)
  sessionTracks?: RawTrack[],
  // set when the view is one row of a comparative view: the import form has
  // already opened its genome, and the steps left are about that row, so each
  // says which one it belongs to
  row?: string,
  // the session holds more than this one view, so a track goes in through the
  // view's own track selector (see OPEN_TRACK)
  viaTrackSelector = false,
  viewType = view.type,
  // shared by the rows of one view, so only the first says how to add a track
  told = { addTrack: false },
): { steps: RecipeStep[]; unmapped: string[] } {
  const steps: RecipeStep[] = []
  const unmapped: string[] = []
  const form = view.type ? IMPORT_FORM_VIEWS[view.type] : undefined

  if (view.assembly && !row) {
    const assembly = lookupAssembly(config, view.assembly)
    const kind = assembly ? fileKind(assembly.adapterType) : undefined
    steps.push({
      title:
        'Open your genome: **Open new genome** in JBrowse Desktop, or `jbrowse add-assembly` for JBrowse Web.',
      example: `This figure uses ${view.assembly}${kind ? `, loaded from ${kind}` : ''}.`,
    })
  }

  if (form) {
    const formSteps = importFormSteps(view, form, config, sessionTracks)
    steps.push(...formSteps.steps)
    unmapped.push(...formSteps.unmapped)
  } else {
    for (const entry of specTracks(view)) {
      const { unmapped: trackUnmapped, ...step } = trackStep(
        entry,
        config,
        viewType,
        sessionTracks,
        undefined,
        viaTrackSelector,
        told.addTrack,
      )
      told.addTrack ||= step.title.startsWith('Add your track')
      steps.push(step)
      unmapped.push(...trackUnmapped)
    }
  }

  if (view.loc) {
    steps.push({
      title: 'Go to your region in the location box.',
      example: `This figure is at ${view.loc}.`,
    })
  }

  const viewFieldSteps = fieldSteps(
    viewSettingEntries(view).filter(
      ([field]) => !(form && field in launchFields),
    ),
    viewFields,
    { noun: 'feature', viewType: view.type },
  )
  steps.push(...viewFieldSteps.steps)
  unmapped.push(...viewFieldSteps.unmapped)

  for (const [index, subView] of (view.views ?? []).entries()) {
    const label = form
      ? `${form.rowLabel(index)}${subView.assembly ? ` (${subView.assembly})` : ''}`
      : undefined
    // a sub-view is never the session's only view, so its tracks go in through
    // its own track selector
    const sub = viewSteps(
      subView,
      config,
      sessionTracks,
      label,
      true,
      subView.type ?? rowViewType(view.type),
      told,
    )
    steps.push(...(label ? groupSteps(label, sub.steps) : sub.steps))
    unmapped.push(...sub.unmapped)
  }

  return { steps, unmapped }
}

export interface CliRecipe {
  // one `jbrowse` command per session track, blank-line separated
  commands: string
  // the assemblies those tracks name, which the target config has to declare
  // already — add-track only warns about one it cannot find
  assemblies: string[]
}

// configTracks writes the figure's tracks as a config.json holds them, so the
// CLI can put them in one: `add-track` where the config is CLI-clean, and
// `add-track-json` verbatim for the rest, which is most of them here — a
// figure's track usually carries the display settings that are the point of
// the figure. Both derivations are the ones behind the Config/CLI tabs on a
// docs fence, and check-config-cli round-trips what they emit through the real
// CLI.
export function deriveCliRecipe(tracks: RawTrack[]) {
  return tracks.length
    ? {
        commands: tracks
          .map(
            track =>
              deriveAddTrack(track) ??
              deriveAddTrackJson(JSON.stringify(track, null, 2)),
          )
          .join('\n\n'),
        assemblies: [
          ...new Set(tracks.flatMap(track => track.assemblyNames ?? [])),
        ],
      }
    : undefined
}

// Opening a figure in Desktop writes a real session to disk, so the name it
// carries is the one the reader lives with — in the session UI, and in the
// recent-sessions list once autosaves are shown. Every figure link says
// `sessionName=Screenshot` (the screenshot generator's own name, see
// sessionSpecQuery), which would name every session a reader ever opened
// "Screenshot". Rename to the figure it came from, which is both meaningful and
// distinct per figure. The web link keeps the generator's name: it isn't
// persisted there, and changing it would re-capture every figure.
export function withSessionName(
  url: string,
  figureName: string | undefined,
) {
  const rewritten = new URL(url)
  rewritten.searchParams.set(
    'sessionName',
    figureName ? `JBrowse docs: ${figureName}` : 'JBrowse docs example',
  )
  return rewritten.href
}

export function buildRecipe(
  liveUrl: string,
  // the screenshot-spec name of the figure this link belongs to, when it has
  // one (a hand-set `link=` on a <Figure> does not)
  figureName?: string,
): Recipe | undefined {
  const decoded = decodeSpecUrl(liveUrl)
  if (!decoded) {
    return undefined
  }
  const { base, config, spec } = decoded
  const sessionTracks = spec.sessionTracks as RawTrack[] | undefined
  const views = spec.views ?? []
  const collected = views.map(view =>
    viewSteps(view, config, sessionTracks, undefined, views.length > 1),
  )
  const desktopWebUrl = withSessionName(liveUrl, figureName)
  const specJson = JSON.stringify(spec, null, 2)
  const configUrl = new URL(config, base).href
  const plugin = needsPlugin(config, spec)
  const frame = figureName
    ? (figureFrames[figureName] ?? videoFrames[figureName])
    : undefined
  // A figure of two panes describes both, each pane's steps under the one
  // that opens it: **Add → <view>**, unless the pane already says how it
  // opened, which an import form and a graph view on a GFA file both do.
  const steps = collected.flatMap((c, index) =>
    views.length < 2
      ? c.steps
      : c.steps.some(step => step.opensView)
        ? groupSteps(`Pane ${index + 1}`, c.steps)
        : [
            {
              title: `Open pane ${index + 1}: **Add → ${viewName(views[index]?.type)}**.`,
              substeps: c.steps,
            },
          ],
  )
  return {
    liveUrl,
    desktopWebUrl,
    // built with Desktop's own helper, so the link the docs hand out and the
    // one the app parses cannot drift apart
    desktopUrl: toProtocolUrl(desktopWebUrl),
    config,
    configUrl,
    specJson,
    steps,
    python: plugin ? undefined : pythonSnippet(configUrl, spec),
    agent: {
      brief: agentBrief(decoded),
      frames: [captureFrame(decoded, figureName)],
      notes: [],
    },
    img: plugin ? undefined : imgRecipe(spec, configUrl, frame?.width),
    cli: deriveCliRecipe(configTracks(decoded)),
    unmapped: [...new Set(collected.flatMap(c => c.unmapped))],
  }
}
