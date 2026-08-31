import { modeDescriptors, viewModes } from './modes.ts'

import type { ViewMode } from './modes.ts'
import type { AssertTrue, Covers } from './types.ts'
import type { defaultThemes } from '@jbrowse/core/ui/theme'
import type { CigarMode } from '@jbrowse/plugin-linear-comparative-view'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

export interface OptionDef {
  name: string
  description: string
  default?: number | boolean | string
  // Comparative modes that actually read this flag; absent means all of them.
  // The dotplot has no ribbon shape and no levels, so its init interface carries
  // none of drawCurves/cigarMode/alpha/levelHeights — listing them under
  // `dotplot --help` documented flags that then silently did nothing. One table
  // drives both the per-subcommand help and the warning in main.ts.
  modes?: ViewMode[]
}

// Default output width in pixels, shared by the --width help default, the CLI
// (main.ts), and the renderRegion library default so they can't drift.
export const DEFAULT_WIDTH = 1500

// Default font for the whole SVG, shared by the --fontFamily help default and
// the renderRegion library default (applied in baseSvgOpts) so the CLI and
// library agree and the value lives in one place.
export const DEFAULT_FONT_FAMILY = 'serif'

// "a, b, or c" — builds the help text of an enum-valued flag from its value list
// so the two can't drift.
function orList(values: readonly string[]) {
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`
}

// The fixed value sets of the enum-valued flags. Each is pinned to the union the
// consuming plugin/package actually accepts, in both directions:
//  - `satisfies` rejects a value the union no longer has (renamed or removed
//    upstream), which would otherwise leave the CLI accepting a dead value
//  - AssertCovers rejects a value the union GAINED, which would otherwise leave
//    the CLI warning on a mode that now works
// `as const` keeps the literal types, so each getter returns a narrow union
// rather than string, and the help text below is generated from the same list.
const trackLabelModes = [
  'offset',
  'overlay',
  'left',
  'none',
] as const satisfies readonly TrackLabelMode[]

const cigarModes = [
  'off',
  'matches',
  'full',
] as const satisfies readonly CigarMode[]

// Synteny ribbon coloring, the `colorBy` slot of the comparative views' init.
// Validated rather than passed through as a bare string: the view coerces an
// unknown mode back to 'default' (coerceColorBy), so a typo like `--colorBy
// quary` silently rendered the default red instead of reporting itself.
const syntenyColorByModes = [
  'default',
  'strand',
  'query',
  'target',
  'reference',
  'identity',
  'meanQueryIdentity',
  'mappingQuality',
  'dnds',
  'track',
] as const satisfies readonly SyntenyColorBy[]

// The built-in theme names, pinned to core's own defaultThemes registry so a
// theme added or renamed there fails the build here rather than leaving the CLI
// silently rejecting (or offering) a theme that no longer matches.
type ThemeName = keyof typeof defaultThemes

export const themeNames = [
  'default',
  'lightStock',
  'lightMinimal',
  'darkStock',
  'darkMinimal',
] as const satisfies readonly ThemeName[]

// Collected into one alias, and exported, because a type alias referenced
// nowhere is a lint error — the same reason AssertSnapshotKeysExist is exported
// from applyTrackOpts.ts.
export type AssertEnumListsCoverUpstream = [
  AssertTrue<Covers<TrackLabelMode, typeof trackLabelModes>>,
  AssertTrue<Covers<CigarMode, typeof cigarModes>>,
  // Exclude(…, `attribute:${string}`): the CLI enumerates the NAMED modes, and
  // the open attribute arm is by construction unenumerable. A new named mode
  // still fails here, which is what this assertion is for.
  AssertTrue<
    Covers<
      Exclude<SyntenyColorBy, `attribute:${string}`>,
      typeof syntenyColorByModes
    >
  >,
  AssertTrue<Covers<ThemeName, typeof themeNames>>,
]

const optionDefs: OptionDef[] = [
  { name: 'fasta', description: 'Path to indexed FASTA file' },
  {
    name: 'chromSizes',
    description:
      'Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view',
  },
  { name: 'aliases', description: 'Path to reference name aliases file' },
  {
    name: 'assembly',
    description: 'Path to assembly JSON (or "-" for stdin) or name in config',
  },
  {
    name: 'hub',
    description:
      'Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)',
  },
  {
    name: 'track',
    description:
      'Show a trackId already in the config (from --hub/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)',
  },
  {
    name: 'config',
    description: 'Path to JBrowse config.json (path, URL, or "-" for stdin)',
  },
  { name: 'session', description: 'Path to session JSON (or "-" for stdin)' },
  {
    name: 'loc',
    description:
      'Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)',
  },
  {
    name: 'out',
    description:
      'Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats',
  },
  {
    name: 'width',
    description: 'Width of output in pixels',
    default: DEFAULT_WIDTH,
  },
  {
    name: 'noRasterize',
    description: 'Disable rasterization of pileup/coverage',
    default: false,
  },
  {
    name: 'defaultSession',
    description: 'Use default session from config',
    default: false,
  },
  {
    name: 'tracks',
    description:
      'Path to JSON file with an array of track configs (or "-" for stdin)',
  },
  { name: 'cytobands', description: 'Path to cytoband file for the assembly' },
  {
    name: 'themeName',
    description: `Theme for rendering: ${orList(themeNames)}`,
  },
  {
    name: 'fontFamily',
    description:
      'Font family for all text (serif, sans-serif, monospace, or a named family)',
    default: DEFAULT_FONT_FAMILY,
  },
  {
    name: 'showGridlines',
    description: 'Show genomic coordinate gridlines in the output',
    default: false,
  },
  {
    name: 'trackLabels',
    description: `Track label position: ${orList(trackLabelModes)}`,
  },
  {
    name: 'refseq',
    description: 'Show the reference sequence track',
    default: false,
  },
  {
    name: 'spec',
    description:
      'Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config',
  },
]

// Extra options accepted only by the comparative subcommands (dotplot/synteny).
// Assemblies stack in argv order: repeat --fasta/--chromSizes per assembly and
// put each synteny file (--paf/--chain/…) between the two it compares. Per-
// assembly options ride on the assembly flag as `loc:`/`aliases:`/`cytobands:`
// modifiers; --fasta2/--loc2/--aliases2 are kept as the two-assembly shorthand.
const comparativeOptionDefs: OptionDef[] = [
  { name: 'fasta2', description: 'Second assembly indexed FASTA (shorthand)' },
  { name: 'aliases2', description: 'Reference name aliases for fasta2' },
  { name: 'loc2', description: 'Location on the second assembly' },
  {
    name: 'autoDiagonalize',
    description:
      "Reorder the next assembly's chromosomes for least overlap (a clean diagonal)",
    default: false,
  },
  {
    name: 'drawCurves',
    description: 'Draw synteny ribbons as bezier curves instead of trapezoids',
    default: false,
    modes: ['synteny'],
  },
  {
    name: 'minAlignmentLength',
    description: 'Hide alignments shorter than N bp (de-spaghetti a busy plot)',
  },
  {
    name: 'colorBy',
    description: `Color synteny ribbons (e.g. "query" tints by query chromosome): ${orList(syntenyColorByModes)}`,
  },
  {
    name: 'alpha',
    description: 'Ribbon opacity 0-1 (lower reveals density)',
    modes: ['synteny'],
  },
  {
    name: 'levelHeights',
    description:
      'Comma-separated pixel height per level, e.g. 300,300 (one value applies to all)',
    modes: ['synteny'],
  },
  {
    name: 'cigarMode',
    description:
      "CIGAR-level indel detail in synteny ribbons: 'off' (blocks only), 'matches' (indels see-through), or 'full' (indels colored) [default: full]",
    modes: ['synteny'],
  },
  {
    name: 'showColorLegend',
    description: 'Show the floating colorBy legend',
    default: false,
  },
]

// Comparative options accepted only by the dotplot/synteny subcommands; exposed
// so the CLI can warn when they're passed without a comparative subcommand.
export const comparativeOptionNames = comparativeOptionDefs.map(o => o.name)

// The comparative options this mode actually honors. A flag whose `modes` list
// excludes the mode is neither shown in that subcommand's help nor silently
// accepted by it — main.ts warns instead.
function comparativeOptionsFor(mode: ViewMode) {
  return comparativeOptionDefs.filter(o => !o.modes || o.modes.includes(mode))
}

// Comparative flags the given mode ignores, so the CLI can say so rather than
// drop them. Empty for a non-comparative mode: there the blanket "no effect
// without the dotplot or synteny subcommand" warning already covers every one.
export function ignoredComparativeOptions(mode: ViewMode) {
  return comparativeOptionDefs
    .filter(o => o.modes && !o.modes.includes(mode))
    .map(o => o.name)
}

const examples: [string, string][] = [
  [
    '--fasta ref.fa --bam reads.bam --loc chr1:1-10000 --out out.svg',
    'Render BAM alignments to SVG',
  ],
  [
    '--fasta ref.fa --vcfgz variants.vcf.gz --loc chr1:1-50000 --out out.png',
    'Render VCF variants to PNG',
  ],
  [
    '--fasta ref.fa --bam reads.bam height:80 color:strand --loc chr1:1-10000 --out out.svg',
    'Custom track height and strand coloring',
  ],
  [
    '--hub hg19 --track hg19-ncbiRefSeqCurated --loc chr1:1-100000 --out out.svg',
    'Pull the hg19 config from genomes.jbrowse.org and show a hosted track',
  ],
  [
    '--config jbrowse.json --assembly hg38 --tracks tracks.json --loc chr1:1-100000 --out out.svg',
    'Render from config with a JSON tracks file',
  ],
  [
    '--fasta ref.fa.gz --cytobands cytobands.bed --bigwig signal.bw --loc chr1 --out out.svg',
    'Render BigWig with cytobands',
  ],
]

const comparativeExamples: [string, string][] = [
  [
    'dotplot --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --out out.svg',
    'Whole-genome dotplot of two assemblies via a PAF',
  ],
  [
    'synteny --fasta a.fa loc:chr1 --paf a_vs_b.paf --fasta b.fa loc:chr1 --out out.svg',
    'Linear synteny of a region in each assembly (loc: rides on the assembly flag)',
  ],
  [
    'synteny --chromSizes a.sizes --paf a_b.paf --chromSizes b.sizes --chain b_c.chain --chromSizes c.sizes --out out.svg',
    'Multi-way (3+) synteny: repeat the assembly flag, put each alignment between the pair it compares',
  ],
  [
    'synteny --config jbrowse.json --spec spec.json --out out.svg',
    'N-way synteny from a config + session-spec JSON (see urlparams.md)',
  ],
]

const circularExamples: [string, string][] = [
  [
    'circular --fasta ref.fa --vcfgz sv.vcf.gz --out out.svg',
    'Circular (chord) view of structural variants',
  ],
]

// Repeating --loc stacks a panel; a space INSIDE one --loc adds a window to
// that panel, which is what a space already means to a LinearGenomeView. The
// two levels need different separators or the common case stops being
// expressible the moment one side wants a second window.
const breakpointExamples: [string, string][] = [
  [
    'breakpoint --fasta ref.fa --bam tumor.bam --loc chr1:1,000,000-1,001,000 --loc chr5:2,000,000-2,001,000 --out sv.png',
    'Both sides of one breakend, with the reads that cross it drawn between',
  ],
  [
    'breakpoint --hub hg38 --bam tumor.bam --loc chr3:25,358,000-25,361,000 --loc chr10:58,716,500-58,718,500 --loc chr12:72,272,000-72,275,000 --out chain.png',
    'A multi-hop chain: one panel per locus, in the order the reads cross them',
  ],
  [
    'breakpoint --fasta ref.fa --bam tumor.bam --loc "chr9:28,030,000-28,032,000 chr9:28,058,000-28,060,000" --loc chr9:28,059,000-28,061,000 --out fb.png',
    'Quote one --loc to put several windows in a single panel',
  ],
]

export function getString(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  return typeof v === 'string' ? v : undefined
}

// Parse a boolean CLI value. `true`/`false` (and a bare flag, which arrives as
// the boolean `true`) map directly; an absent flag is `false`. Anything else
// warns and is treated as false, so a typo (`--refseq ture`) or a loose value
// (`--refseq 0`, which the old `!!str` wrongly made truthy) is visible instead
// of silently on. Track modifiers ask the same question but THROW on an
// unusable value (parseBool in applyTrackOpts.ts): the flags here are view
// cosmetics, a modifier changes what the image shows.
export function getBooleanValue(value: unknown, label: string) {
  const result =
    value === true || value === 'true'
      ? true
      : value === undefined || value === false || value === 'false'
        ? false
        : undefined
  if (result === undefined) {
    console.warn(
      `Warning: expected true or false for ${label}, got "${String(value)}"; treating as false`,
    )
  }
  return result ?? false
}

export function getBoolean(rest: Record<string, unknown>, key: string) {
  return getBooleanValue(rest[key], `--${key}`)
}

// A numeric flag. Absent is undefined; a present value that isn't a number
// warns and is treated as absent, so `--width 120O` reports itself rather than
// quietly rendering at the default — the reporting the enum-valued (getEnum) and
// boolean (getBooleanValue) flags already do, which numbers were the last flag
// type not to. An empty value (`--width=`) counts as unusable too: `Number('')`
// is 0, which would render a zero-width image.
export function getOptionalNumber(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  if (v === undefined) {
    return undefined
  }
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN
  if (!Number.isFinite(n)) {
    console.warn(
      `Warning: expected a number for --${key}, got "${String(v)}"; ignoring`,
    )
    return undefined
  }
  return n
}

export function getNumber(
  rest: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  return getOptionalNumber(rest, key) ?? fallback
}

// A count: a whole number of things, so a fraction or a negative is a mistake
// rather than a value. Both spellings reached something that accepted them
// quietly — `--limit=-2` is `slice(0, -2)`, which renders all but the LAST two,
// and a negative `--flank` inverts the window into a `start greater than end`
// that every record then fails on separately. Warned and dropped, like every
// other unusable flag value here.
export function getOptionalCount(rest: Record<string, unknown>, key: string) {
  const n = getOptionalNumber(rest, key)
  if (n !== undefined && (n < 0 || !Number.isInteger(n))) {
    console.warn(
      `Warning: --${key} takes a whole number of 0 or more, got "${n}"; ignoring`,
    )
    return undefined
  }
  return n
}

// Resolve a flag against a fixed set of allowed values, warning (rather than
// silently falling back to the default) when a present value isn't one of them —
// a typo like `--cigarMode ful` or `--trackLabels lft` should be reported, the
// same way an unknown option name is.
function getEnum<T extends string>(
  rest: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
) {
  const v = getString(rest, key)
  const match = allowed.find(a => a === v)
  if (v !== undefined && !match) {
    console.warn(
      `Warning: unknown --${key} "${v}" (expected ${allowed.join(', ')}); ignoring`,
    )
  }
  return match
}

// A comma-separated numeric list (e.g. --levelHeights 300,300). A non-numeric
// entry warns rather than being dropped in silence, which turned
// `--levelHeights 300,abc` into a one-level list — and one value applies to
// every level, so that read as deliberate. Undefined when the flag is absent or
// nothing usable was given.
export function getNumberList(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  if (typeof v !== 'string') {
    return undefined
  }
  const list: number[] = []
  for (const entry of v.split(',')) {
    const n = entry.trim() === '' ? Number.NaN : Number(entry)
    if (Number.isFinite(n)) {
      list.push(n)
    } else {
      console.warn(`Warning: ignoring non-numeric entry "${entry}" in --${key}`)
    }
  }
  return list.length ? list : undefined
}

// One getter per enum-valued flag, so the flag name and its allowed-value list
// are bound in one place — a bare getEnum(rest, key, allowed) call site can pair
// the wrong list with a key and still compile.
export function getTrackLabels(rest: Record<string, unknown>) {
  return getEnum(rest, 'trackLabels', trackLabelModes)
}

export function getCigarMode(rest: Record<string, unknown>) {
  return getEnum(rest, 'cigarMode', cigarModes)
}

export function getThemeName(rest: Record<string, unknown>) {
  return getEnum(rest, 'themeName', themeNames)
}

export function getColorBy(rest: Record<string, unknown>) {
  return getEnum(rest, 'colorBy', syntenyColorByModes)
}

// The output formats of a batch run, which are the extensions writeRendered
// dispatches on. Validated rather than folded to png by an `=== 'svg'` test:
// `--format jpg` silently wrote a PNG, and `--format SVG` did too.
const batchFormats = ['png', 'svg', 'pdf'] as const

export type BatchFormat = (typeof batchFormats)[number]

export function getFormat(rest: Record<string, unknown>) {
  return getEnum(rest, 'format', batchFormats)
}

// Options only the `batch` subcommand reads. Kept out of optionDefs so they do
// not appear in every subcommand's help, but listed here so they are not
// reported as unknown when batch is what is running.
export const batchOptionDefs: OptionDef[] = [
  {
    name: 'vcf',
    description:
      'VCF (plain or bgzipped) of junctions to render, one image per junction',
  },
  {
    name: 'bedpe',
    description:
      'BEDPE of junctions to render, one image per row; the format for anything a VCF cannot express (a LINX TSV reshaped by awk)',
  },
  {
    name: 'outDir',
    description: 'Directory to write the images to',
    default: 'jb2export-batch',
  },
  {
    name: 'flank',
    description: 'bp of context around each breakend',
    default: '500',
  },
  { name: 'limit', description: 'Render only the first N rows' },
  {
    name: 'format',
    description: `Output format: ${orList(batchFormats)}`,
    default: 'png',
  },
  {
    name: 'passOnly',
    description: 'Skip VCF records whose FILTER is neither PASS nor "."',
    default: false,
  },
  {
    name: 'resume',
    description:
      'Skip a record whose image is already in --outDir, so an interrupted run picks up where it stopped',
    default: false,
  },
  {
    name: 'manifest',
    description:
      'Also write manifest.tsv to --outDir: one row per record with its file, loci, name and status',
    default: false,
  },
  {
    name: 'dryRun',
    description:
      'Print the file and loci each record would render, and render nothing',
    default: false,
  },
]

// Options a batch run cannot honor, in the two kinds it has of not honoring
// them. Neither appears in `batch --help`, which used to list every one.
//
// DROPPED: `--outDir` replaces `--out`, and the junction file replaces `--loc`
// (a stray one would render the same window for every row). Harmless, so they
// are warned about and ignored.
//
// REFUSED: `--spec` and `--session` FIX the view, and in a batch that is N
// identical images under N filenames each naming a different junction —
// `renderBreakpoint` prefers a spec over the per-record panels, and
// `addLaunchView` adopts a session's view of the same type. Silent, and wrong in
// the direction that looks like it worked.
export const batchDroppedOptions = ['out', 'loc']
export const batchRefusedOptions = ['spec', 'session']
const batchUnsupported = new Set([
  ...batchDroppedOptions,
  ...batchRefusedOptions,
])

export const knownOptions = new Set([
  ...optionDefs.map(o => o.name),
  ...comparativeOptionDefs.map(o => o.name),
  ...batchOptionDefs.map(o => o.name),
  'help',
  'version',
])

export function buildBatchHelp(scriptName: string) {
  const defs = [
    ...optionDefs.filter(o => !batchUnsupported.has(o.name)),
    ...batchOptionDefs,
  ]
  const pad = Math.max(...defs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} batch --vcf <file> [options]`,
    '',
    'Renders one breakpoint split view per BEDPE row: both loci stacked, with',
    'the reads that leave one panel and arrive in the other drawn between them.',
    'The module graph loads once for the whole callset, so this is much faster',
    `than a shell loop over "${scriptName} breakpoint".`,
    '',
    'Options:',
    ...formatOpts(defs, pad),
    '',
    'Examples:',
    ...formatExamples(scriptName, [
      [
        'batch --vcf calls.vcf.gz --fasta ref.fa --bam tumor.bam --outDir figs --flank 1000',
        'A contact sheet of every junction in a callset',
      ],
      [
        'batch --vcf calls.vcf.gz --hub hg38 --bam tumor.bam --limit 20',
        'The first 20, to check the framing before committing to the whole run',
      ],
      [
        'batch --bedpe linx_links.bedpe --hub hg38 --bam tumor.bam',
        'The same from a BEDPE, for a caller whose output is not a VCF',
      ],
    ]),
    '',
    'The ALT grammar is parsed by @gmod/vcf, so inserted sequence at the',
    'junction and upper-cased mate contigs are handled; reciprocal breakend',
    'pairs collapse, so each junction is queued once.',
  ].join('\n')
}

function formatOpts(defs: OptionDef[], pad: number) {
  return defs.map(o => {
    const suffix = o.default === undefined ? '' : ` [default: ${o.default}]`
    return `  --${o.name.padEnd(pad)}  ${o.description}${suffix}`
  })
}

function formatExamples(scriptName: string, list: [string, string][]) {
  return list.map(([cmd, desc]) => `  ${scriptName} ${cmd}\n      ${desc}`)
}

// Examples shown in a subcommand's --help. Dotplot and synteny share the same
// comparative examples; circular and linear have their own.
function examplesForMode(mode: ViewMode) {
  switch (mode) {
    case 'dotplot':
    case 'synteny':
      return comparativeExamples
    case 'circular':
      return circularExamples
    case 'breakpoint':
      return breakpointExamples
    case 'linear':
      return examples
  }
}

// Help for a subcommand. Dotplot/synteny compare two assemblies (second-assembly
// options + comparison file types); circular/linear are single-assembly.
function buildSubcommandHelp(
  scriptName: string,
  mode: ViewMode,
  syntenyTrackTypes: string[],
) {
  const { comparative } = modeDescriptors[mode]
  const defs = comparative
    ? [...optionDefs, ...comparativeOptionsFor(mode)]
    : optionDefs
  const pad = Math.max(...defs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} ${modeDescriptors[mode].subcommand} [options]`,
    '',
    'Options:',
    ...formatOpts(defs, pad),
    '',
    'Examples:',
    ...formatExamples(scriptName, examplesForMode(mode)),
    ...(comparative
      ? [
          '',
          `Comparison track options: ${syntenyTrackTypes.map(t => `--${t}`).join(', ')}`,
        ]
      : []),
  ].join('\n')
}

export function buildHelp(
  scriptName: string,
  trackTypes: string[],
  syntenyTrackTypes: string[],
  mode?: ViewMode,
) {
  if (mode) {
    return buildSubcommandHelp(scriptName, mode, syntenyTrackTypes)
  }
  // linear is the implicit default, so the explicit subcommands users invoke are
  // the non-linear view types (shown by their CLI token).
  const subcommandNames = viewModes
    .filter(mode => mode !== 'linear')
    .map(mode => modeDescriptors[mode].subcommand)
  const pad = Math.max(...optionDefs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} [options]`,
    `       ${scriptName} <${subcommandNames.join('|')}> [options]`,
    `       ${scriptName} list [hub] [filter]`,
    '',
    'Options:',
    ...formatOpts(optionDefs, pad),
    `  --${'help'.padEnd(pad)}  Show help`,
    `  --${'version'.padEnd(pad)}  Print version`,
    '',
    'Examples:',
    ...formatExamples(scriptName, examples),
    '',
    `Track options: ${trackTypes.map(t => `--${t}`).join(', ')}`,
    '',
    `Comparative subcommands (run "${scriptName} dotplot --help"): ${subcommandNames.join(', ')}`,
    '',
    `Discovery: "${scriptName} list" lists genomes.jbrowse.org assemblies; "${scriptName} list <hub> [filter]" lists a hub's tracks`,
  ].join('\n')
}

// The complete help reference: the top-level help followed by each subcommand's
// help. The docs embed this so the published help can't drift from the code.
export function buildFullHelp(
  scriptName: string,
  trackTypes: string[],
  syntenyTrackTypes: string[],
) {
  const subcommandHelp = viewModes
    .filter(mode => mode !== 'linear')
    .map(mode => buildHelp(scriptName, trackTypes, syntenyTrackTypes, mode))
  return [
    buildHelp(scriptName, trackTypes, syntenyTrackTypes),
    ...subcommandHelp,
  ].join('\n\n')
}
