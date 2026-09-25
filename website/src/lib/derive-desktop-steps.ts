// The third way to apply a config block: the GUI route, for a reader running
// JBrowse Desktop who owns neither a config.json nor the CLI. Derived from the
// same JSON the other tabs are, so the steps cannot name a field the config
// does not carry, and refused outright for an assembly the add-genome form has
// no input for (aliases, a non-sibling index) rather than shown with the
// unexpressible part silently dropped.
//
// Tracks need no refusal: "Add track from pasted JSON"
// (plugins/data-management/src/AddTrackWidget/components/PasteConfigWorkflow.tsx)
// takes any track config verbatim, in Desktop and in a web session alike. A
// graph track has a form of its own in the GraphGenomeView plugin, and the tab
// walks that instead, since a config pasted as JSON is the one route a reader
// cannot adapt to their own file without reading the adapter's docs.
import { addRelativeUris } from '../../../packages/core/src/util/addRelativeUris.ts'
import { aliasesUri } from './derive-add-assembly.ts'
import { asRecord, nonEmpty } from './derive-cli-command.ts'

import type { Code, List, Paragraph, PhrasingContent, RootContent } from 'mdast'

function text(value: string) {
  return { type: 'text', value } satisfies PhrasingContent
}

function strong(value: string) {
  return { type: 'strong', children: [text(value)] } satisfies PhrasingContent
}

function inline(value: string) {
  return { type: 'inlineCode', value } satisfies PhrasingContent
}

function paragraph(children: PhrasingContent[]) {
  return { type: 'paragraph', children } satisfies Paragraph
}

function raw(value: string): RootContent {
  return { type: 'html', value }
}

function bullets(items: PhrasingContent[][]) {
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: items.map(children => ({
      type: 'listItem' as const,
      spread: false,
      children: [paragraph(children)],
    })),
  } satisfies List
}

// The app's own strings, named once so scripts/check-menu-labels.ts can hold
// this file to the same bar as doc prose: a renamed menu item has to fail a
// build, not sit in a tab nobody re-reads.
export const DESKTOP_UI_LABELS = {
  openGenome: 'Open new genome',
  openGenomeMenu: 'File → Open genome...',
  fromUrl: 'Open from a URL',
  openTrack: 'File → Open track...',
  pasteJson: 'Add track from pasted JSON',
  syntenyView: 'Add → Linear synteny view',
  quickStart: 'Quick start',
  launch: 'Launch',
  moreOptions: 'More options',
  genomeName: 'Genome name',
  displayName: 'Assembly display name',
  refNameAliases: 'refName aliases',
  cytobands: 'cytobands',
}

// A field under the form's "More options" expander, which is where everything
// but the sequence and the name lives (packages/core/src/ui/AdvancedOptions.tsx).
function moreOption(label: string, value: string) {
  return [
    strong(label),
    text(' (under '),
    strong(DESKTOP_UI_LABELS.moreOptions),
    text('): '),
    inline(value),
  ]
}

// The GraphGenomeView plugin's add-track form
// (src/GraphAddTrackWorkflow in jbrowse-plugin-graphgenomeviewer), held by
// scripts/check-menu-labels.ts against that checkout the way DESKTOP_UI_LABELS
// is held against this repo.
export const GRAPH_FORM_LABELS = {
  workflow: 'Add pangenome graph track',
  fileType: 'File type',
  sample: 'Sample name in the graph',
  trackName: 'Track name',
  assembly: 'Assembly',
}

const GRAPH_ADAPTERS: Record<
  string,
  { choice: string; locationSlot: string; suffix: string }
> = {
  RgfaTabixAdapter: {
    choice: 'rGFA segments (tabix BED pair)',
    locationSlot: 'segmentsLocation',
    suffix: '.segs.bed.gz',
  },
  MinigraphBubbleAdapter: {
    choice: 'Minigraph bubbles (tabix BED)',
    locationSlot: 'bubblesLocation',
    suffix: '',
  },
}

function relativeUris(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(relativeUris)
  }
  if (value === null || typeof value !== 'object') {
    return []
  }
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'uri' &&
    typeof child === 'string' &&
    !/^(\w+:\/\/|\/)/.test(child)
      ? [child]
      : relativeUris(child),
  )
}

// A relative uri resolves against the config.json it sits in, and a paste or a
// form has none, so the reader's copy loads nothing until it names a real file.
// A file written as a bare string resolves the same way, and addRelativeUris is
// what knows which strings those are.
function relativeUriNote(config: unknown): RootContent[] {
  const lifted = structuredClone(config)
  if (typeof lifted === 'object' && lifted !== null) {
    addRelativeUris(
      lifted as Record<string, unknown>,
      new URL('https://config.invalid/'),
    )
  }
  const uris = [...new Set(relativeUris(lifted))]
  return uris.length
    ? [
        paragraph([
          ...uris.flatMap((uri, i) => [
            ...(i > 0 ? [text(', ')] : []),
            inline(uri),
          ]),
          text(
            uris.length > 1
              ? ' are relative to a config.json. Replace each with its URL or its path on this computer.'
              : ' is relative to a config.json. Replace it with its URL or its path on this computer.',
          ),
        ]),
      ]
    : []
}

function field(label: string, value: string) {
  return [strong(label), text(': '), inline(value)]
}

// The form's fields, filled from the config, or undefined for a config the
// form has no field for (a display the config sets by hand).
function graphFormNodes(
  config: Record<string, unknown>,
): RootContent[] | undefined {
  const adapter = asRecord(config.adapter)
  const form = GRAPH_ADAPTERS[String(adapter.type)]
  const assembly = (config.assemblyNames as unknown[] | undefined)?.[0]
  if (!form || config.displays || typeof assembly !== 'string') {
    return undefined
  }
  const file =
    typeof adapter.uri === 'string'
      ? `${adapter.uri}${form.suffix}`
      : asRecord(adapter[form.locationSlot]).uri
  if (typeof file !== 'string') {
    return undefined
  }
  const sample = asRecord(adapter.assemblyNameToPanSN)[assembly]
  return [
    raw('<div class="desktop-steps">'),
    paragraph([
      text(
        'In JBrowse Desktop, or in any running JBrowse Web session, open a view on this track’s assembly, then ',
      ),
      strong(DESKTOP_UI_LABELS.openTrack),
      text(', choose '),
      strong(GRAPH_FORM_LABELS.workflow),
      text(', and fill in:'),
    ]),
    bullets([
      field(GRAPH_FORM_LABELS.fileType, form.choice),
      field('Path', file),
      ...(typeof sample === 'string'
        ? [field(GRAPH_FORM_LABELS.sample, sample)]
        : []),
      field(GRAPH_FORM_LABELS.trackName, String(config.name ?? config.trackId)),
      field(GRAPH_FORM_LABELS.assembly, assembly),
    ]),
    ...relativeUriNote(config),
    raw('</div>'),
  ]
}

export function desktopTrackNodes(
  config: Record<string, unknown>,
  json: string,
): RootContent[] {
  const form = graphFormNodes(config)
  if (form) {
    return form
  }
  return [
    raw('<div class="desktop-steps">'),
    paragraph([
      text(
        'In JBrowse Desktop, or in any running JBrowse Web session, open a view on this track’s assembly, then ',
      ),
      strong(DESKTOP_UI_LABELS.openTrack),
      text(', choose '),
      strong(DESKTOP_UI_LABELS.pasteJson),
      text(', and paste:'),
    ]),
    { type: 'code', lang: 'json', value: json } satisfies Code,
    ...relativeUriNote(config),
    ...(config.type === 'SyntenyTrack'
      ? [
          paragraph([
            text('That shows it in the linear view. For the synteny view, open '),
            strong(DESKTOP_UI_LABELS.syntenyView),
            text(', pick the track under '),
            strong(DESKTOP_UI_LABELS.quickStart),
            text(', and click '),
            strong(DESKTOP_UI_LABELS.launch),
            text('.'),
          ]),
        ]
      : []),
    raw('</div>'),
  ]
}

// The index files the add-genome form asks for once it recognizes a format,
// named the way the sequence guesser derives them (plugins/sequence). The form
// does not derive them itself: it warns "This format needs its index file(s)"
// and waits, so a reader pasting only the FASTA gets stuck where the config
// shorthand and the CLI would both have filled them in.
const SIDECAR_EXTENSIONS: [RegExp, string[]][] = [
  [/\.(fa|fas|fna|fasta|mfa)\.b?gz$/i, ['.fai', '.gzi']],
  [/\.(fa|fas|fna|fasta|mfa)$/i, ['.fai']],
  [/\.2bit$/i, []],
  [/\.chrom\.sizes$/i, []],
]

// `cytobands` as the form writes it (a CytobandAdapter over one file) or as the
// uri shorthand; a custom adapter has no field and refuses the whole tab.
function cytobandsUri(cytobands: unknown) {
  const slot = asRecord(cytobands)
  const adapter = asRecord(slot.adapter)
  return (
    nonEmpty(slot.uri) ??
    (adapter.type === undefined || adapter.type === 'CytobandAdapter'
      ? (nonEmpty(adapter.uri) ??
        nonEmpty(asRecord(adapter.cytobandLocation).uri))
      : undefined)
  )
}

export function desktopAssemblyNodes(
  config: unknown,
): RootContent[] | undefined {
  const {
    name,
    uri,
    displayName,
    sequence,
    refNameAliases,
    cytobands,
    ...restTop
  } = asRecord(config)
  const {
    type: sequenceType,
    trackId,
    adapter,
    ...seqExtra
  } = asRecord(sequence)
  const {
    type: adapterType,
    uri: adapterUri,
    ...adapterExtra
  } = asRecord(adapter)

  const assemblyName = nonEmpty(name)
  const file = nonEmpty(uri) ?? nonEmpty(adapterUri)
  // the same bar deriveAddAssembly holds the CLI tab to: the uri shorthand and
  // the boilerplate the form itself writes back. An explicit adapter type or a
  // non-sibling faiLocation is a config the form cannot be walked through.
  const boilerplateSequence =
    adapterType === undefined &&
    (sequenceType === undefined || sequenceType === 'ReferenceSequenceTrack') &&
    (trackId === undefined ||
      trackId === `${assemblyName}-ReferenceSequenceTrack`) &&
    Object.keys(seqExtra).length === 0 &&
    Object.keys(adapterExtra).length === 0
  const sidecars = file
    ? SIDECAR_EXTENSIONS.find(([re]) => re.test(file))?.[1]
    : undefined
  const aliases = aliasesUri(refNameAliases)
  const cytobandFile = cytobandsUri(cytobands)
  // resolved as an object rather than a boolean so the pieces stay narrowed:
  // the tab exists exactly when the form has an input for every key
  const resolved =
    assemblyName &&
    file &&
    sidecars &&
    boilerplateSequence &&
    Object.keys(restTop).length === 0 &&
    (refNameAliases === undefined || aliases) &&
    (cytobands === undefined || cytobandFile)
      ? { assemblyName, urls: [file, ...sidecars.map(ext => `${file}${ext}`)] }
      : undefined
  const display = nonEmpty(displayName)
  return resolved
    ? [
        raw('<div class="desktop-steps">'),
        paragraph([
          text('In JBrowse Desktop, '),
          strong(DESKTOP_UI_LABELS.openGenome),
          text(' on the start screen (or '),
          strong(DESKTOP_UI_LABELS.openGenomeMenu),
          text(' in a session), then '),
          strong(DESKTOP_UI_LABELS.fromUrl),
          text(
            resolved.urls.length > 1
              ? ' and paste, one per line:'
              : ' and paste:',
          ),
        ]),
        {
          type: 'code',
          lang: 'text',
          value: resolved.urls.join('\n'),
        } satisfies Code,
        paragraph([
          text('JBrowse reads the format off the file name. Then fill in:'),
        ]),
        bullets([
          [
            strong(DESKTOP_UI_LABELS.genomeName),
            text(': '),
            inline(resolved.assemblyName),
          ],
          ...(display
            ? [moreOption(DESKTOP_UI_LABELS.displayName, display)]
            : []),
          ...(aliases
            ? [moreOption(DESKTOP_UI_LABELS.refNameAliases, aliases)]
            : []),
          ...(cytobandFile
            ? [moreOption(DESKTOP_UI_LABELS.cytobands, cytobandFile)]
            : []),
        ]),
        ...relativeUriNote(config),
        raw('</div>'),
      ]
    : undefined
}
