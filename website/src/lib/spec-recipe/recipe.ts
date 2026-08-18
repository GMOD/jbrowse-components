import { fileKind, lookupAssembly, lookupTrack } from './configs.ts'

import type { RawTrack } from './configs.ts'
import {
  decodeSpecUrl,
  specDisplayType,
  specTrackId,
  specTrackSettings,
  specTracks,
} from './decode.ts'
import { IGNORED_FIELDS, trackFields, viewFields } from './fields.ts'
import { toProtocolUrl } from '../../../../products/jbrowse-desktop/electron/launchTarget.ts'

import type { TrackInfo } from './configs.ts'
import type { SpecTrackEntry, SpecView } from './decode.ts'
import type { FieldContext, FieldRecipe } from './fields.ts'

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
  // Which pane, row and track the step belongs to, general to specific.
  // Collected as the recipe is built and folded into `example` at the end, so a
  // step gains a segment wherever a figure has more than one of something and
  // the reader would otherwise be counting identical steps.
  where?: string[]
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
  specJson: string
  steps: RecipeStep[]
  python?: string
  // the `npx @jbrowse/capture` invocation that rebuilds this figure, for an
  // agent asked to make one like it
  agentCommand: string
  // spec fields with no verified click-path yet (surfaced by check-spec-recipes)
  unmapped: string[]
}

// jbrowse-anywidget drives a linear genome view only, so a synteny/dotplot/SV
// figure gets no Python tab rather than a snippet that cannot work.
const PYTHON_VIEW_TYPE = 'LinearGenomeView'
// fetch_hub serves ready-made configs for these; anything else needs the reader
// to describe their own assembly.
const HUB_GENOMES = new Set(['hg38', 'hg19', 'mm10', 'mm39'])

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
// passes 'read' at its own call site (its model.ts) and the canvas displays
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
  for (const [field, value] of entries) {
    if (IGNORED_FIELDS.has(field)) {
      continue
    }
    const step = table[field]?.(value, context)
    if (step) {
      steps.push({
        title: step.path,
        note: step.note,
        opensView: step.opensView,
      })
    } else {
      unmapped.push(field)
    }
  }
  return { steps, unmapped }
}

// Says which pane, row or track a run of steps belongs to. A recipe with three
// of anything reads as three copies of one step otherwise, and the reader has
// only the order to go on. Outermost caller wins the leading segment, since
// each level of the walk labels what it is looping over.
function labelSteps(steps: RecipeStep[], label: string): RecipeStep[] {
  return steps.map(step => ({ ...step, where: [label, ...(step.where ?? [])] }))
}

function withWhere({ where, ...step }: RecipeStep): RecipeStep {
  if (!where?.length) {
    return step
  }
  const breadcrumb = where.join(' · ')
  return {
    ...step,
    example: step.example ? `${breadcrumb} — ${step.example}` : `${breadcrumb}.`,
  }
}

// The track's own name as a breadcrumb segment, falling back to the id a
// figure's config doesn't carry a name for.
function trackName(
  entry: SpecTrackEntry,
  config: string,
  sessionTracks?: RawTrack[],
): string {
  const trackId = specTrackId(entry)
  return `“${lookupTrack(config, trackId, sessionTracks)?.name ?? trackId}”`
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

// See the FieldContext note in trackStep: the one branch of pickDisplayForView a
// static script can evaluate for itself.
function soleDeclaredDisplay(info: TrackInfo | undefined): string | undefined {
  return info?.declaredDisplayTypes.length === 1
    ? info.declaredDisplayTypes[0]
    : undefined
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
  'Add your own track: **File → Open track...**, then paste a URL or choose a local file.'
const ADD_TRACK =
  "Add your own track: open this view's track selector, click **+** and choose **Add track**, then paste a URL or choose a local file."

function trackStep(
  entry: SpecTrackEntry,
  config: string,
  sessionTracks?: RawTrack[],
  band?: BandContext,
  viaTrackSelector?: boolean,
): RecipeStep & { settings: RecipeStep[]; unmapped: string[] } {
  const trackId = specTrackId(entry)
  const info = lookupTrack(config, trackId, sessionTracks)
  const kind = info ? fileKind(info.adapterType) : undefined
  // The spec's own `type` first. Failing that, the track config's declared
  // display — but only when it declares exactly one, which is the case
  // `pickDisplayForView` settles without consulting the registry: with a
  // single declared display there is nothing for the view's supported-types
  // filter to choose between. Several declared, or none, still yields
  // undefined rather than a guess.
  const displayType = specDisplayType(entry) ?? soleDeclaredDisplay(info)
  const context: FieldContext = {
    noun: trackNoun(info?.type, displayType),
    displayType,
  }
  const { steps: settings, unmapped } = fieldSteps(
    specTrackSettings(entry),
    trackFields,
    context,
  )
  const name = info ? `“${info.name}”` : `the “${trackId}” track`
  const needs = kind ? ` This one needs ${kind}.` : ''
  return {
    title: band
      ? `Point the import form at your own file: ${band.form.band}, choose **New track**, and paste a URL or pick a local file.${needs}`
      : `${viaTrackSelector ? ADD_TRACK : OPEN_TRACK}${needs}`,
    example:
      band && band.bands > 1
        ? `This figure uses ${name} for ${band.bands === 2 ? 'both bands' : `all ${band.bands} bands`}.`
        : `This figure uses ${name}.`,
    settings,
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
        'Open your genomes: on the JBrowse Desktop start screen click **Open new genome** (or **Show all available genomes** to pick a hosted one), then **File → Open genome...** for each of the rest.',
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
      settings,
      unmapped: trackUnmapped,
      ...step
    } = trackStep(entry, config, sessionTracks, {
      form,
      bands: distinct.length === 1 ? entries.length : 0,
    })
    steps.push(
      index === 0
        ? {
            ...step,
            note: `A synteny track the session already has is quicker: pick it under **Quick start**, which fills in ${form.rowsControl} itself.`,
          }
        : step,
      ...settings,
    )
    unmapped.push(...trackUnmapped)
  }

  // A figure OF the empty import form names neither assemblies nor tracks, and
  // it is the form itself that the picture shows — launching is the step after
  // the one it illustrates.
  if (assemblies.length || entries.length) {
    steps.push({ title: 'Click **Launch**.' })
  }
  return { steps, unmapped }
}

function pythonSnippet(
  view: SpecView,
  config: string,
  sessionTracks?: RawTrack[],
): string | undefined {
  const assembly = view.assembly
  if (view.type !== PYTHON_VIEW_TYPE || !assembly) {
    return undefined
  }
  const isHub = HUB_GENOMES.has(assembly)
  const assemblyArg = isHub
    ? `fetch_hub("${assembly}")`
    : `make_assembly("${assembly}", "https://your-server/your-genome.fa.gz")`
  const imports = isHub
    ? 'from jbrowse_anywidget import LinearGenomeView, fetch_hub'
    : 'from jbrowse_anywidget import LinearGenomeView, make_assembly'
  const entries = specTracks(view)
  const tracks = entries.map((entry, i) => {
    const info = lookupTrack(config, specTrackId(entry), sessionTracks)
    const type = info?.type || 'FeatureTrack'
    const adapterType = info?.adapterType || 'BamAdapter'
    // trackIds must be unique within a view, so a multi-track snippet can't
    // reuse one placeholder name
    const suffix = entries.length > 1 ? `_${i + 1}` : ''
    return [
      'view.add_track({',
      `    "type": "${type}",`,
      `    "trackId": "my_track${suffix}",`,
      `    "name": "My track${suffix ? ` ${i + 1}` : ''}",`,
      `    "assemblyNames": ["${assembly}"],`,
      `    "adapter": {"type": "${adapterType}", "uri": "https://your-server/your-file"},`,
      '})',
    ].join('\n')
  })
  return [
    imports,
    '',
    'view = LinearGenomeView(',
    `    assembly=${assemblyArg},`,
    ...(view.loc ? [`    location="${view.loc}",`] : []),
    ')',
    ...(tracks.length ? ['', ...tracks] : []),
    '',
    'view  # display the widget',
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
): { steps: RecipeStep[]; unmapped: string[] } {
  const steps: RecipeStep[] = []
  const unmapped: string[] = []
  const form = view.type ? IMPORT_FORM_VIEWS[view.type] : undefined

  if (view.assembly && !row) {
    const assembly = lookupAssembly(config, view.assembly)
    const kind = assembly ? fileKind(assembly.adapterType) : undefined
    steps.push({
      title:
        'Open your genome: on the JBrowse Desktop start screen click **Open new genome** (or **Show all available genomes** to pick a hosted one).',
      example: `This figure uses ${view.assembly}${kind ? `, loaded from ${kind}` : ''}.`,
    })
  }

  if (form) {
    const formSteps = importFormSteps(view, form, config, sessionTracks)
    steps.push(...formSteps.steps)
    unmapped.push(...formSteps.unmapped)
  } else {
    const entries = specTracks(view)
    for (const entry of entries) {
      const {
        settings,
        unmapped: trackUnmapped,
        ...step
      } = trackStep(entry, config, sessionTracks, undefined, viaTrackSelector)
      // Three tracks in one view produce three runs of "Track menu → ..." with
      // nothing between them, and every one of those menus hangs off a
      // different track's label. The settings say which.
      steps.push(
        step,
        ...(entries.length > 1
          ? labelSteps(settings, trackName(entry, config, sessionTracks))
          : settings),
      )
      unmapped.push(...trackUnmapped)
    }
  }

  if (view.loc) {
    steps.push({
      title:
        'Type your region of interest into the location box and press Enter.',
      example: `This figure is at ${view.loc}.`,
    })
  }

  const viewFieldSteps = fieldSteps(Object.entries(view), viewFields, {
    noun: 'feature',
    viewType: view.type,
  })
  steps.push(...viewFieldSteps.steps)
  unmapped.push(...viewFieldSteps.unmapped)

  for (const [index, subView] of (view.views ?? []).entries()) {
    const label = form
      ? `${form.rowLabel(index)}${subView.assembly ? ` (${subView.assembly})` : ''}`
      : undefined
    // a sub-view is never the session's only view, so its tracks go in through
    // its own track selector
    const sub = viewSteps(subView, config, sessionTracks, label, true)
    steps.push(...(label ? labelSteps(sub.steps, label) : sub.steps))
    unmapped.push(...sub.unmapped)
  }

  return { steps, unmapped }
}

// The shell command that rebuilds this figure headlessly.
//
// A figure's `config=` is written as the live link needs it — usually relative
// to the instance serving it (`test_data/volvox/config.json`) — and a command
// run from anywhere else has to resolve that against the instance's own origin
// or fetch nothing. The spec goes to a file rather than inline: it is a whole
// JSON document, and quoting one into a shell argument is the step an agent
// most reliably gets wrong.
function agentCommandFor(base: string, config: string, specJson: string) {
  const configUrl = new URL(config, base).href
  const instance = base.endsWith('/') ? base : `${base}/`
  return [
    "cat > session.json <<'JSON'",
    specJson,
    'JSON',
    '',
    `npx @jbrowse/capture --instance ${instance} \\`,
    `  --config ${configUrl} \\`,
    '  --session session.json -o figure.png',
  ].join('\n')
}

// Opening a figure in Desktop writes a real session to disk, so the name it
// carries is the one the reader lives with — in the session UI, and in the
// recent-sessions list once autosaves are shown. Every figure link says
// `sessionName=Screenshot` (the screenshot generator's own name, see
// sessionSpecQuery), which would name every session a reader ever opened
// "Screenshot". Rename to the figure it came from, which is both meaningful and
// distinct per figure. The web link keeps the generator's name: it isn't
// persisted there, and changing it would re-capture every figure.
function withSessionName(url: string, figureName: string | undefined) {
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
  const firstView = views[0]
  const desktopWebUrl = withSessionName(liveUrl, figureName)
  const specJson = JSON.stringify(spec, null, 2)
  return {
    liveUrl,
    desktopWebUrl,
    // built with Desktop's own helper, so the link the docs hand out and the
    // one the app parses cannot drift apart
    desktopUrl: toProtocolUrl(desktopWebUrl),
    config,
    specJson,
    // A figure of two panes describes both, and the reader has to know which
    // pane each step opens a genome or a track in. **Add → <view>** is what
    // makes a pane exist, so it leads that pane's steps — unless the pane
    // already says how it opened, which an import form and a launched-from-a-
    // track graph view both do.
    steps: collected
      .flatMap((c, index) => {
        if (views.length < 2) {
          return c.steps
        }
        const opened = c.steps.some(step => step.opensView)
        return [
          ...(opened
            ? []
            : [
                {
                  title: `Open pane ${index + 1}: **Add → ${viewName(views[index]?.type)}**.`,
                },
              ]),
          ...labelSteps(c.steps, `Pane ${index + 1}`),
        ]
      })
      .map(withWhere),
    python: firstView
      ? pythonSnippet(firstView, config, sessionTracks)
      : undefined,
    agentCommand: agentCommandFor(base, config, specJson),
    unmapped: [...new Set(collected.flatMap(c => c.unmapped))],
  }
}
