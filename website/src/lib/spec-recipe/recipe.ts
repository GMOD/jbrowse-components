import { fileKind, lookupAssembly, lookupTrack } from './configs.ts'
import {
  decodeSpecUrl,
  specTrackId,
  specTrackSettings,
  specTracks,
} from './decode.ts'
import { IGNORED_FIELDS, trackFields, viewFields } from './fields.ts'
import { toProtocolUrl } from '../../../../products/jbrowse-desktop/electron/launchTarget.ts'

import type { SpecTrackEntry, SpecView } from './decode.ts'
import type { FieldContext } from './fields.ts'

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
}

export interface Recipe {
  liveUrl: string
  // the same view as a jbrowse:// link, which an installed JBrowse Desktop
  // opens directly
  desktopUrl: string
  config: string
  specJson: string
  steps: RecipeStep[]
  python?: string
  // spec fields with no verified click-path yet (surfaced by check-spec-recipes)
  unmapped: string[]
}

// jbrowse-anywidget drives a linear genome view only, so a synteny/dotplot/SV
// figure gets no Python tab rather than a snippet that cannot work.
const PYTHON_VIEW_TYPE = 'LinearGenomeView'
// fetch_hub serves ready-made configs for these; anything else needs the reader
// to describe their own assembly.
const HUB_GENOMES = new Set(['hg38', 'hg19', 'mm10', 'mm39'])

// Labels that name what a track holds read naturally only if the noun matches
// the track ('Fixed read height' for a pileup, 'Fixed feature height' otherwise).
function trackNoun(trackType: string | undefined): string {
  return trackType === 'AlignmentsTrack' ? 'read' : 'feature'
}

function trackStep(
  entry: SpecTrackEntry,
  config: string,
): RecipeStep & { settings: RecipeStep[] } {
  const trackId = specTrackId(entry)
  const info = lookupTrack(config, trackId)
  const kind = info ? fileKind(info.adapterType) : undefined
  const context: FieldContext = { noun: trackNoun(info?.type) }
  const settings = specTrackSettings(entry).flatMap(([field, value]) => {
    const step = IGNORED_FIELDS.has(field)
      ? undefined
      : trackFields[field]?.(value, context)
    return step ? [{ title: step.path, note: step.note }] : []
  })
  return {
    title: kind
      ? `Add your own track: **File → Open track...**, then paste a URL or choose a local file. This one needs ${kind}.`
      : 'Add your own track: **File → Open track...**, then paste a URL or choose a local file.',
    example: info ? `This figure uses “${info.name}”.` : `This figure uses the “${trackId}” track.`,
    settings,
  }
}

function pythonSnippet(view: SpecView, config: string): string | undefined {
  const assembly = view.assembly
  if (view.type !== PYTHON_VIEW_TYPE || !assembly) {
    return undefined
  }
  const assemblyArg = HUB_GENOMES.has(assembly)
    ? `fetch_hub("${assembly}")`
    : `make_assembly("${assembly}", "https://your-server/your-genome.fa.gz")`
  const imports = HUB_GENOMES.has(assembly)
    ? 'from jbrowse_anywidget import LinearGenomeView, fetch_hub'
    : 'from jbrowse_anywidget import LinearGenomeView, make_assembly'
  const entries = specTracks(view)
  const tracks = entries.map((entry, i) => {
    const info = lookupTrack(config, specTrackId(entry))
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
): { steps: RecipeStep[]; unmapped: string[] } {
  const steps: RecipeStep[] = []
  const unmapped: string[] = []

  if (view.assembly) {
    const assembly = lookupAssembly(config, view.assembly)
    const kind = assembly ? fileKind(assembly.adapterType) : undefined
    steps.push({
      title:
        'Open your genome: on the JBrowse Desktop start screen click **Open new genome** (or **Show all available genomes** to pick a hosted one).',
      example: `This figure uses ${view.assembly}${kind ? `, loaded from ${kind}` : ''}.`,
    })
  }

  for (const entry of specTracks(view)) {
    const { settings, ...step } = trackStep(entry, config)
    steps.push(step, ...settings)
    const context: FieldContext = {
      noun: trackNoun(lookupTrack(config, specTrackId(entry))?.type),
    }
    for (const [field, value] of specTrackSettings(entry)) {
      if (!IGNORED_FIELDS.has(field) && !trackFields[field]?.(value, context)) {
        unmapped.push(field)
      }
    }
  }

  if (view.loc) {
    steps.push({
      title: 'Type your region of interest into the location box and press Enter.',
      example: `This figure is at ${view.loc}.`,
    })
  }

  const viewContext: FieldContext = { noun: 'feature' }
  for (const [field, value] of Object.entries(view)) {
    const step = IGNORED_FIELDS.has(field)
      ? undefined
      : viewFields[field]?.(value, viewContext)
    if (step) {
      steps.push({ title: step.path, note: step.note })
    } else if (!IGNORED_FIELDS.has(field) && !viewFields[field]) {
      unmapped.push(field)
    }
  }

  for (const subView of view.views ?? []) {
    const sub = viewSteps(subView, config)
    steps.push(...sub.steps)
    unmapped.push(...sub.unmapped)
  }

  return { steps, unmapped }
}

export function buildRecipe(liveUrl: string): Recipe | undefined {
  const decoded = decodeSpecUrl(liveUrl)
  if (!decoded) {
    return undefined
  }
  const { config, spec } = decoded
  const views = spec.views ?? []
  const collected = views.map(view => viewSteps(view, config))
  const firstView = views[0]
  return {
    liveUrl,
    // built with Desktop's own helper, so the link the docs hand out and the
    // one the app parses cannot drift apart
    desktopUrl: toProtocolUrl(liveUrl),
    config,
    specJson: JSON.stringify(spec, null, 2),
    steps: collected.flatMap(c => c.steps),
    python: firstView ? pythonSnippet(firstView, config) : undefined,
    unmapped: [...new Set(collected.flatMap(c => c.unmapped))],
  }
}
