import { CODE_BASE } from '../src/lib/code-base.ts'

import type { RExportCli } from './screenshot-spec-types.ts'

// Turn one rexport spec's `cli` declaration plus the view it re-exports into the
// ordinary file-flag jb2export argv — `--fasta … --loc … --bam …`.
//
// Split from rexportCommand.ts, and pure, for the reason rexportCommandText.ts
// is: looking a spec's source view up needs the whole spec registry, which
// reaches puppeteer through screenshot-specs and so cannot be loaded by Jest's
// CJS transform. Everything with a rule worth pinning lives here instead — the
// declaration says only WHERE THE FILES ARE, and this derives the rest from the
// source view, so the published command cannot drift onto a different loc, a
// different panel order or a display setting the figure was not drawn with.

/**
The session-spec view a source figure is rendered from.
*/
export interface SourceView {
  loc: string
  tracks: (string | Record<string, unknown>)[]
  [key: string]: unknown
}

// A repo-relative path is rewritten onto CODE_BASE — the hosted mirror of
// test_data, which is also what the figure's "Open in JBrowse" link opens. It
// applies to a --config and to every file a `cli` command names, for one
// reason: those uris are read by rtracklayer / Rsamtools / samtools, which are
// built for remote genomics files over https and are markedly less happy
// range-reading a BigWig or CRAM off a local dev server. (A JBrowse config also
// addresses its data RELATIVE TO ITSELF, so in the config form the base the
// config is fetched from is the base every track file inherits.)
export function hosted(path: string) {
  return /^https?:/.test(path) ? path : `${CODE_BASE}${path}`
}

// The view keys a `cli` command builds from, beyond the tracks themselves.
// `assembly` is named by --fasta instead, and `type` is LinearGenomeView by
// construction (jb2export's default mode).
const VIEW_KEYS_HANDLED = new Set(['type', 'assembly', 'loc', 'tracks'])

// View settings the R export does not draw, so leaving them out of a `cli`
// command changes nothing about the figure — jb2export's own spec path already
// reports each of them as an ignored view prop. They are browser chrome: the
// centre line, the CDS-frame tint and the highlight bands are painted by JBrowse
// over the canvas, and R panel titles are always drawn (there is no `offset`
// mode to ask for). Anything NOT listed throws rather than being dropped, so a
// view setting added to a browser figure cannot go missing from its R twin in
// silence.
const VIEW_KEYS_NOT_IN_R = new Set([
  'showCenterLine',
  'colorByCDS',
  'highlight',
  'trackLabels',
])

// The display each track-type flag opens by default, so a source spec that
// merely restates it (`"type": "LinearBasicDisplay"` on a GFF track) doesn't put
// a redundant `display:` token in the published command. A wrong entry shows up
// in the figure either way — a `display:` that shouldn't be there is visible in
// the command, and a missing one draws the wrong display.
const DEFAULT_DISPLAY: Record<string, string> = {
  bam: 'LinearAlignmentsDisplay',
  cram: 'LinearAlignmentsDisplay',
  bigwig: 'LinearWiggleDisplay',
  multiwig: 'MultiLinearWiggleDisplay',
  vcfgz: 'LinearVariantDisplay',
  gff: 'LinearBasicDisplay',
  gffgz: 'LinearBasicDisplay',
  bedgz: 'LinearBasicDisplay',
  bigbed: 'LinearBasicDisplay',
  hic: 'LinearHicDisplay',
}

/**
 * The file-flag argv for a spec that declares one: the assembly, the source
 * view's loc, then one track flag per declared file carrying that track's own
 * display state from the source spec. `name` is the spec's, for error messages.
 */
export function rExportCliArgs(
  name: string,
  cli: RExportCli,
  view: SourceView,
) {
  const unknown = Object.keys(view).filter(
    k => !VIEW_KEYS_HANDLED.has(k) && !VIEW_KEYS_NOT_IN_R.has(k),
  )
  if (unknown.length > 0) {
    throw new Error(
      `${name}: source view sets ${unknown.join(', ')}, which the file-flag command has no way to pass. Add it to VIEW_KEYS_NOT_IN_R (with why the R figure doesn't need it), or drop the spec's cli block.`,
    )
  }

  // Track order is panel order, so the declaration has to list the source
  // spec's tracks in the source spec's order — checked rather than assumed,
  // since a reordered browser figure would otherwise publish a command that
  // stacks the panels differently from the picture above it.
  const shown = view.tracks.map(t =>
    typeof t === 'string' ? t : `${t.trackId}`,
  )
  const dropped = new Set((cli.dropTracks ?? []).map(t => t.trackId))
  const missing = shown.filter(
    id => !dropped.has(id) && !cli.tracks.some(t => t.trackId === id),
  )
  if (missing.length > 0) {
    throw new Error(
      `${name}: cli names no file for ${missing.join(', ')}. Add it to cli.tracks, or to cli.dropTracks with the reason it isn't drawn.`,
    )
  }
  const inOrder = shown.filter(id => !dropped.has(id))
  const expected = cli.tracks.map(t => t.trackId)
  if (inOrder.join(',') !== expected.join(',')) {
    throw new Error(
      `${name}: cli.tracks is ordered ${expected.join(', ')} but the source spec shows ${inOrder.join(', ')}; panel order follows argv order`,
    )
  }

  const args = ['--fasta', hosted(cli.fasta)]
  if (cli.aliases) {
    args.push('--aliases', hosted(cli.aliases))
  }
  args.push('--loc', view.loc)
  const byId = new Map(
    view.tracks.map(t => [typeof t === 'string' ? t : `${t.trackId}`, t]),
  )
  for (const track of cli.tracks) {
    const files = Array.isArray(track.file) ? track.file : [track.file]
    const opts = track.opts ?? []
    args.push(`--${track.flag}`, files.map(hosted).join(','))
    args.push(...opts.filter(o => !o.startsWith('{')))
    // A declared `{json}` opt is display state the CONFIG supplied, so a bare
    // file has to say it; it merges UNDER the source spec's own state, which is
    // where the browser figure gets it from too.
    const fromConfig = opts
      .filter(o => o.startsWith('{'))
      .map(o => JSON.parse(o) as Record<string, unknown>)
    const entry = byId.get(track.trackId)
    // Fold the source spec's track entry into a display snapshot exactly as the
    // session spec itself does (normalizeTrackInit): inline keys ARE display
    // props, and an explicit `displaySnapshot` wins over one of the same name.
    const { trackSnapshot, displaySnapshot, ...inline } =
      typeof entry === 'object' ? entry : {}
    if (trackSnapshot) {
      throw new Error(
        `${name}: ${track.trackId} carries a trackSnapshot, which patches the track CONFIG — a file flag builds that config itself, so there is nothing to patch. Drop the spec's cli block.`,
      )
    }
    const { trackId, type, ...state } = Object.assign(
      {},
      ...fromConfig,
      inline,
      displaySnapshot,
    ) as Record<string, unknown>
    if (typeof type === 'string' && type !== DEFAULT_DISPLAY[track.flag]) {
      args.push(`display:${type}`)
    }
    // The rest goes through verbatim as jb2export's `{json}` track modifier.
    // Translating each key to its named modifier (`height:300`) would read
    // better, and is exactly how a setting comes to be published as one the
    // figure was not drawn with.
    if (Object.keys(state).length > 0) {
      args.push(JSON.stringify(state))
    }
  }
  return args
}
