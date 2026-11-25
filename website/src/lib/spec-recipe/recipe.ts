import { deriveAddTrack, deriveAddTrackJson } from '../derive-add-track.ts'
import {
  DESKTOP_UI_LABELS,
  GRAPH_FORM_LABELS,
  graphFormChoice,
  isGraphAdapter,
} from '../derive-desktop-steps.ts'
import {
  defaultDisplay,
  fileKind,
  lookupAssembly,
  lookupRawTrack,
  lookupTrack,
  ownDisplaySettings,
  rowViewType,
} from './configs.ts'
import { takeArrangement } from './arrangements.ts'
import { agentBrief, captureFrame } from './agent.ts'
import { rebuildTracks } from './configTracks.ts'
import { embedSnippet } from './embed.ts'
import { imgRecipe } from './img.ts'
import { figureFrames, videoFrames } from '../liveLinks.generated.ts'

import type { RawTrack, TrackInfo  } from './configs.ts'
import {
  decodeSpecUrl,
  flatSettings,
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
import { toProtocolUrl } from '../../../../packages/core/src/util/jbrowseProtocol.ts'

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
  openTrackAddsHere: boolean
  steps: RecipeStep[]
  // absent when a view needs a plugin the widget cannot load from the config
  python?: string
  // the same view as a React component, absent where the notebook snippet is
  embed?: string
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

// A view no menu adds: the reader opens it from a feature in a linear view, which
// it copies the tracks of into every panel.
const LAUNCHED_VIEWS: Record<string, { opener: string; note: string }> = {
  BreakpointSplitView: {
    opener:
      'Right-click a read that spans the breakpoint, or a breakend variant → **Open breakpoint split view**.',
    note: 'Each panel opens on one end of the join, with the tracks of the view it was opened from.',
  },
}

// Labels that name what a track holds read naturally only if the noun matches
// the track ('Read height' for a pileup, 'Feature height' otherwise).
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

function notesOnce(steps: RecipeStep[], seen = new Set<string>()): RecipeStep[] {
  return steps.map(({ note, substeps, ...step }) => {
    const fresh = (note?.split(/(?<=[.!?]) (?=[A-Z*`])/) ?? []).filter(
      sentence => !seen.has(sentence) && seen.add(sentence),
    )
    return {
      ...step,
      ...(fresh.length ? { note: fresh.join(' ') } : {}),
      ...(substeps ? { substeps: notesOnce(substeps, seen) } : {}),
    }
  })
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

// Views a figure's own steps open some other way: the linear view the app
// starts in, and the ones opened from a feature or a track rather than the Add
// menu
const OPENED_ELSEWHERE = new Set([
  'LinearGenomeView',
  'ProteinView',
  'GraphGenomeView',
])

// A figure's only view, when it is not the linear view the genome opens in,
// is opened from the Add menu right after the genome step
function withOpenViewStep(steps: RecipeStep[], view: SpecView | undefined) {
  const type = view?.type
  const at = view?.assembly ? 1 : 0
  return type &&
    !OPENED_ELSEWHERE.has(type) &&
    !(type in IMPORT_FORM_VIEWS) &&
    !(type in LAUNCHED_VIEWS) &&
    !steps.some(step => step.opensView)
    ? [
        ...steps.slice(0, at),
        {
          title: `Open the view: **Add → ${viewName(type)}**.`,
          opensView: true,
        },
        ...steps.slice(at),
      ]
    : steps
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
  "Add your track: **+** → **Add track...** in this view's track selector, or check it there."

const OPEN_TRACK_VIEWS = new Set(['LinearGenomeView', 'CircularView'])

const NEXT_TRACK = 'Add the next track the same way.'

function addTrackTitle(
  info: TrackInfo | undefined,
  kind: string | undefined,
  band: BandContext | undefined,
  viaTrackSelector: boolean | undefined,
  repeat: boolean | undefined,
) {
  const graphChoice = info
    ? graphFormChoice(info.type, info.adapterType)
    : undefined
  const pasted =
    info?.adapterType === 'FromConfigAdapter'
      ? 'Its features sit inline in its config'
      : info && isGraphAdapter(info.adapterType) && !graphChoice
        ? `The pangenome graph form makes another track type from ${kind ?? 'this file'}`
        : undefined
  const needs = pasted
    ? ` ${pasted}: choose **${DESKTOP_UI_LABELS.pasteJson}** and paste the track.`
    : kind
      ? ` Needs ${kind}.`
      : ''
  const ordinary =
    info?.type !== 'ReferenceSequenceTrack' && !band && !graphChoice && !pasted
  return {
    ordinary,
    title:
      info?.type === 'ReferenceSequenceTrack'
        ? `Show the sequence: check **${info.name}** in the track selector.`
        : band
          ? `Add your file: ${band.form.band} and choose **New track**.${needs}`
          : graphChoice
            ? `Add your graph: ${viaTrackSelector ? "**+** → **Add track...** in this view's track selector" : `**${DESKTOP_UI_LABELS.openTrack}**`}, choose **${GRAPH_FORM_LABELS.workflow}**, and set **${GRAPH_FORM_LABELS.fileType}** to **${graphChoice}**.`
            : `${ordinary && repeat ? NEXT_TRACK : viaTrackSelector ? ADD_TRACK : OPEN_TRACK}${needs}`,
  }
}

// A track or adapter type no core plugin registers
function fromPlugin(info: TrackInfo) {
  return (
    (info.type !== '' && !(info.type in configManifest.tracks)) ||
    (info.adapterType !== '' && !(info.adapterType in configManifest.adapters))
  )
}

const GRAPH_PLUGIN_NOTE =
  'Needs the GraphGenomeView plugin: install it from **Tools → Plugin store**.'
const PLUGIN_NOTE =
  'Needs the plugin this track type comes from: install it from **Tools → Plugin store**.'

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
): RecipeStep & { unmapped: string[]; ordinary: boolean } {
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
  // The track's own display config first, the spec's settings over it. Then
  // an arrangement, and the per-field walk over what it did not claim: the
  // settings one menu row writes together are one step, not one step each.
  // A setting only the config holds and no step covers is named on the track,
  // since the session spec the figure's gaps point to does not carry it.
  const own = flatSettings(
    ownDisplaySettings(
      lookupRawTrack(config, trackId, sessionTracks),
      displayType,
    ),
  )
  const spec = specTrackSettings(entry)
  const arrangement = takeArrangement(
    [...new Map([...own, ...spec])],
    displayType,
  )
  const walked = fieldSteps(arrangement.rest, trackFields, context)
  const settings = walked.steps
  if (arrangement.step) {
    settings.unshift({ title: arrangement.step.path })
  }
  const fromSpec = new Set(spec.map(([field]) => field))
  const unmapped = walked.unmapped.filter(field => fromSpec.has(field))
  const ownUnmapped = walked.unmapped.filter(field => !fromSpec.has(field))
  const name = info ? `“${info.name}”` : `the “${trackId}” track`
  const notes = [
    ...(info && fromPlugin(info)
      ? [isGraphAdapter(info.adapterType) ? GRAPH_PLUGIN_NOTE : PLUGIN_NOTE]
      : []),
    ...(ownUnmapped.length
      ? [
          `The track's config also sets ${ownUnmapped.map(field => `\`${field}\``).join(', ')}, which no menu step covers yet.`,
        ]
      : []),
  ]
  return {
    ...addTrackTitle(info, kind, band, viaTrackSelector, repeat),
    ...(notes.length ? { note: notes.join(' ') } : {}),
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
        'Open your genomes: **Open your own genome** in JBrowse Desktop, then **File → Open genome...** for each of the rest, or `jbrowse add-assembly` for each in JBrowse Web.',
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
    const {
      unmapped: trackUnmapped,
      ordinary,
      ...step
    } = trackStep(
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
  // the genomes an earlier pane opened, which a later pane picks in its own
  // import form rather than opening again
  genomes = new Set<string>(),
): { steps: RecipeStep[]; unmapped: string[] } {
  const steps: RecipeStep[] = []
  const unmapped: string[] = []
  const form = view.type ? IMPORT_FORM_VIEWS[view.type] : undefined

  if (view.assembly && !row) {
    const assembly = lookupAssembly(config, view.assembly)
    const kind = assembly ? fileKind(assembly.adapterType) : undefined
    steps.push(
      genomes.has(view.assembly)
        ? {
            title: "Pick the same genome in the new view's import form.",
            example: `This figure uses ${view.assembly}.`,
          }
        : {
            title:
              'Open your genome: **Open your own genome** in JBrowse Desktop, or `jbrowse add-assembly` for JBrowse Web.',
            example: `This figure uses ${view.assembly}${kind ? `, loaded from ${kind}` : ''}.`,
          },
    )
    genomes.add(view.assembly)
  }

  // A linear view goes to its region before its tracks go in, so a step that
  // clicks on the data finds it; an import form's view exists only after Launch.
  const region: RecipeStep[] = view.loc
    ? [
        {
          title: 'Go to your region in the location box.',
          example: `This figure is at ${view.loc}.`,
        },
      ]
    : []
  if (form) {
    const formSteps = importFormSteps(view, form, config, sessionTracks)
    steps.push(...formSteps.steps, ...region)
    unmapped.push(...formSteps.unmapped)
  } else {
    steps.push(...region)
    for (const entry of specTracks(view)) {
      const {
        unmapped: trackUnmapped,
        ordinary,
        ...step
      } = trackStep(
        entry,
        config,
        viewType,
        sessionTracks,
        undefined,
        viaTrackSelector,
        told.addTrack,
      )
      told.addTrack = ordinary
      steps.push(step)
      unmapped.push(...trackUnmapped)
    }
  }

  const viewFieldSteps = fieldSteps(
    viewSettingEntries(view).filter(
      ([field]) => !(form && field in launchFields),
    ),
    viewFields,
    { noun: 'feature', viewType: view.type },
  )
  const launched = view.type ? LAUNCHED_VIEWS[view.type] : undefined
  const [firstPanel, ...otherPanels] = view.views ?? []
  if (launched && firstPanel) {
    const first = viewSteps(
      firstPanel,
      config,
      sessionTracks,
      undefined,
      viaTrackSelector,
      firstPanel.type ?? rowViewType(view.type),
      told,
      genomes,
    )
    steps.push(...first.steps, {
      title: launched.opener,
      note: launched.note,
      opensView: true,
    })
    unmapped.push(...first.unmapped)
  }
  steps.push(...viewFieldSteps.steps)
  unmapped.push(...viewFieldSteps.unmapped)

  if (launched && firstPanel) {
    const copied = new Set(specTracks(firstPanel).map(specTrackId))
    for (const [index, panel] of otherPanels.entries()) {
      const added = specTracks(panel).filter(
        entry => !copied.has(specTrackId(entry)),
      )
      const panelSteps = added.map(entry => {
        const {
          unmapped: trackUnmapped,
          ordinary,
          ...step
        } = trackStep(
          entry,
          config,
          panel.type ?? rowViewType(view.type),
          sessionTracks,
          undefined,
          true,
        )
        unmapped.push(...trackUnmapped)
        return step
      })
      steps.push(...groupSteps(`Panel ${index + 2}`, panelSteps))
    }
    return { steps, unmapped }
  }

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
      genomes,
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
  // the names of the figure's styled tracks these commands leave out
  missing: string[]
}

// configTracks writes the figure's tracks as a config.json holds them, so the
// CLI can put them in one: `add-track` where the config is CLI-clean, and
// `add-track-json` verbatim for the rest, which is most of them here — a
// figure's track usually carries the display settings that are the point of
// the figure. Both derivations are the ones behind the Config/CLI tabs on a
// docs fence, and check-config-cli round-trips what they emit through the real
// CLI.
export function deriveCliRecipe(tracks: RawTrack[], missing: string[] = []) {
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
        missing,
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

export function openRecipe(liveUrl: string, figureName?: string) {
  const desktopWebUrl = withSessionName(liveUrl, figureName)
  return {
    liveUrl,
    desktopWebUrl,
    // built with Desktop's own helper, so the link the docs hand out and the
    // one the app parses cannot drift apart
    desktopUrl: toProtocolUrl(desktopWebUrl),
  }
}

export function opensJBrowse(liveUrl: string) {
  return URL.canParse(liveUrl) && new URL(liveUrl).searchParams.has('config')
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
  const genomes = new Set<string>()
  const collected = views.map(view =>
    viewSteps(
      view,
      config,
      sessionTracks,
      undefined,
      views.length > 1,
      view.type,
      undefined,
      genomes,
    ),
  )
  const rebuilt = rebuildTracks(decoded)
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
      ? withOpenViewStep(c.steps, views[index])
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
    ...openRecipe(liveUrl, figureName),
    config,
    configUrl,
    specJson,
    openTrackAddsHere:
      views.length === 1 && OPEN_TRACK_VIEWS.has(views[0]?.type ?? ''),
    steps: notesOnce(steps),
    python: plugin ? undefined : pythonSnippet(configUrl, spec),
    embed: plugin ? undefined : embedSnippet(configUrl, spec),
    agent: {
      brief: agentBrief(decoded),
      frames: [captureFrame(decoded, figureName)],
      notes: [],
    },
    img: plugin ? undefined : imgRecipe(spec, configUrl, frame?.width),
    cli: deriveCliRecipe(rebuilt.tracks, rebuilt.missing),
    unmapped: [...new Set(collected.flatMap(c => c.unmapped))],
  }
}
