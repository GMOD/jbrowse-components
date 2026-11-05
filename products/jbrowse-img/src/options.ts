import { modeDescriptors, viewModes } from './modes.ts'

import type { ViewMode } from './modes.ts'
import type { AssertTrue, Covers } from './types.ts'
import type { LegacyThemeName } from '@jbrowse/core/ui/palette'
import type { ThemeSelectionName } from '@jbrowse/core/ui/theme'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

export interface OptionDef {
  name: string
  description: string
  default?: number | boolean | string
  /** the views the option draws in; absent for every view */
  modes?: readonly ViewMode[]
}

export const DEFAULT_WIDTH = 1500

export const DEFAULT_FONT_FAMILY = 'serif'

function orList(values: readonly string[]) {
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`
}

// `satisfies` catches a value upstream dropped, and the Covers assertion below
// one upstream added.
const trackLabelModes = [
  'offset',
  'overlapping',
  'left',
  'hidden',
] as const satisfies readonly TrackLabelMode[]

type PaletteName = Exclude<ThemeSelectionName, LegacyThemeName>

export const themeNames = [
  'default',
  'stock',
  'minimal',
] as const satisfies readonly PaletteName[]

export const themeModes = ['light', 'dark'] as const

// exported because an unreferenced type alias is a lint error
export type AssertEnumListsCoverUpstream = [
  AssertTrue<Covers<TrackLabelMode, typeof trackLabelModes>>,
  AssertTrue<Covers<PaletteName, typeof themeNames>>,
]

const optionDefs: OptionDef[] = [
  {
    name: 'fasta',
    description:
      'Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files',
  },
  {
    name: 'chromSizes',
    description:
      'Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view',
  },
  {
    name: 'assembly',
    modes: ['linear', 'circular', 'breakpoint'],
    description: "Which of the config's assemblies to open, by name",
  },
  {
    name: 'genome',
    description:
      'Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)',
  },
  {
    name: 'track',
    modes: ['linear', 'circular', 'breakpoint'],
    description:
      'Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)',
  },
  {
    name: 'config',
    description: 'Path to JBrowse config.json (path, URL, or "-" for stdin)',
  },
  { name: 'session', description: 'Path to session JSON (or "-" for stdin)' },
  {
    name: 'loc',
    modes: ['linear', 'breakpoint'],
    description:
      'Location to render (e.g., chr1:1-1000, or "all" for the whole genome: the chromosomes where an NCBI sequence report names them, else every sequence), or a gene name when the config has a text-search index (e.g. from --genome). Several regions draw side by side',
  },
  {
    name: 'view',
    description:
      'Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view',
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
    name: 'trackConfigs',
    description:
      'Path to JSON file with an array of track configs (or "-" for stdin); added to the config\'s tracks, replacing any with the same trackId',
  },
  {
    name: 'themeName',
    description: `Palette for rendering: ${orList(themeNames)}`,
  },
  {
    name: 'themeMode',
    description: 'Draw that palette light or dark',
  },
  {
    name: 'fontFamily',
    description:
      'Font family for all text (serif, sans-serif, monospace, or a named family)',
    default: DEFAULT_FONT_FAMILY,
  },
  {
    name: 'showGridlines',
    modes: ['linear', 'synteny', 'breakpoint'],
    description: 'Show genomic coordinate gridlines in the output',
    default: false,
  },
  {
    name: 'trackLabels',
    modes: ['linear', 'synteny', 'breakpoint'],
    description: `Track label position: ${orList(trackLabelModes)}`,
  },
  {
    name: 'refseq',
    modes: ['linear'],
    description: 'Show the reference sequence track',
    default: false,
  },
  {
    name: 'spec',
    description:
      'Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view, as a batch manifest\'s spec column or a &session=spec- URL writes it; see urlparams.md',
  },
]

const examples: [string, string][] = [
  [
    'ref.fa reads.bam --loc chr1:1-10000 --out out.svg',
    'Render BAM alignments to SVG; each file is typed by its name',
  ],
  [
    'ref.fa --vcf variants.txt.gz --loc chr1:1-50000 --out out.png',
    "Name a file's format with a flag when its name does not say it",
  ],
  [
    'ref.fa reads.bam height:80 color:strand --loc chr1:1-10000 --out out.svg',
    'Custom track height and strand coloring',
  ],
  [
    '--genome hg19 --track hg19-ncbiRefSeqCurated --loc chr1:1-100000 --out out.svg',
    'Pull the hg19 config from genomes.jbrowse.org and show a hosted track',
  ],
  [
    '--config jbrowse.json --assembly hg38 --trackConfigs tracks.json --loc chr1:1-100000 --out out.svg',
    'Render from config with a JSON tracks file',
  ],
  [
    'ref.fa.gz cytobands:cytobands.bed signal.bw --loc chr1 --out out.svg',
    'Render BigWig with cytobands',
  ],
]

const comparativeExamples: [string, string][] = [
  [
    'dotplot --fasta a.fa --fasta b.fa --paf a_vs_b.paf --out out.svg',
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
    'synteny --fasta a.fa --paf a_b.paf --fasta b.fa --view mark.interpolate=bump encoding.color.field=query filter.0.field=length filter.0.gte=10000 --out out.svg',
    'Curved ribbons colored by query chromosome, alignments under 10 kb hidden',
  ],
  [
    'synteny --config jbrowse.json --spec spec.json --out out.svg',
    'N-way synteny from a config + session-spec JSON (see urlparams.md)',
  ],
]

const circularExamples: [string, string][] = [
  [
    'circular ref.fa sv.vcf.gz --out out.svg',
    'Circular (chord) view of structural variants',
  ],
]

const breakpointExamples: [string, string][] = [
  [
    'breakpoint --fasta ref.fa --bam tumor.bam --loc chr1:1,000,000-1,001,000 --loc chr5:2,000,000-2,001,000 --out sv.png',
    'Both sides of one breakend, with the reads that cross it drawn between',
  ],
  [
    'breakpoint --genome hg38 --bam tumor.bam --loc chr3:25,358,000-25,361,000 --loc chr10:58,716,500-58,718,500 --loc chr12:72,272,000-72,275,000 --out chain.png',
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

// Warns rather than throws, unlike launch-args' parseBool for track modifiers:
// these flags are cosmetic, a modifier changes what the image shows.
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

// `Number('')` is 0, so an empty value counts as unusable
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

// A negative `--limit` would reach `slice(0, -n)` and drop the last rows
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

export function getTrackLabels(rest: Record<string, unknown>) {
  return getEnum(rest, 'trackLabels', trackLabelModes)
}

export function getThemeName(rest: Record<string, unknown>) {
  return getEnum(rest, 'themeName', themeNames)
}

export function getThemeMode(rest: Record<string, unknown>) {
  return getEnum(rest, 'themeMode', themeModes)
}

// the extensions writeRendered dispatches on
const batchFormats = ['png', 'svg', 'pdf'] as const

export type BatchFormat = (typeof batchFormats)[number]

export function getFormat(rest: Record<string, unknown>) {
  return getEnum(rest, 'format', batchFormats)
}

export const batchOptionDefs: OptionDef[] = [
  {
    name: 'sites',
    description:
      'The records to render, one image each: a VCF (plain or bgzipped), or a BEDPE (.bedpe or .bedpe.gz) for anything a VCF cannot express (a LINX TSV reshaped by awk)',
  },
  {
    name: 'outDir',
    description: 'Directory to write the images to',
    default: 'jb2export-batch',
  },
  {
    name: 'flank',
    description: 'bp of context around each locus',
    default: '50 for a variant whose alleles are under 50 bp, 500 otherwise',
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
      'Also write manifest.tsv to --outDir: one row per image with its file, loci, name, line in the input, EVENT, the reads joining its windows, the reads with the ALT at its variant, the view as a session spec and status',
    default: false,
  },
  {
    name: 'dryRun',
    description:
      'Print the file and loci each record would render, and render nothing',
    default: false,
  },
  {
    name: 'jobs',
    description:
      'Processes to render in, each about a gigabyte. The default is half the cores, up to 4 and to what memory allows; 1 renders in this process',
  },
]

// batch-only flags pass the unknown-option check, so outside batch they need
// their own warning
export const batchOptionNames = batchOptionDefs.map(o => o.name)

// Dropped options are warned about and ignored. Refused ones fix the view, so
// every row would render the same image.
export const batchDroppedOptions = ['out', 'loc']
export const batchRefusedOptions = ['spec', 'session']
const batchUnsupported = new Set([
  ...batchDroppedOptions,
  ...batchRefusedOptions,
])

export const optionsWithBooleanDefaults = [...optionDefs, ...batchOptionDefs]
  .filter(o => typeof o.default === 'boolean')
  .map(o => o.name)

export const knownOptions = new Set([
  ...optionDefs.map(o => o.name),
  ...batchOptionDefs.map(o => o.name),
  // how a --jobs run tells a worker its slice; nobody types it
  'shard',
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
    `Usage: ${scriptName} batch --sites <file> [options]`,
    '',
    'Renders one image per record, a contig a row. Loci on one contig are a',
    'linear view, their windows side by side: the two ends of a deletion, a',
    'duplication or an inversion, or one window where --flank reaches from one',
    'end to the other. Loci on several contigs are a breakpoint split view of',
    'one panel a contig. A row holds four windows at most, and a contig of',
    'more wraps.',
    '',
    "The reads joining an image's windows are drawn between them, as arcs in",
    'a linear view and as curves in a breakpoint view, and the manifest counts',
    'them. Each alignments track lays out its SV evidence first: split reads,',
    'then reads with an insertion or deletion of 50 bases or more, then',
    'discordant pairs, unless the track sets arcs: or sort= itself.',
    '',
    'Where a record on one contig spells out its alleles, or is a symbolic',
    '<DEL> or <INS>, the manifest also counts the reads with the ALT at its',
    'variant: an SNV at its base, a deletion at its first deleted base, an',
    'insertion at the base after it, and an insertion of 50 bases or more',
    'wherever in the window the aligner placed it. A deletion of 50 bases or',
    'more is a gap of half its length or more. In an image of one window',
    'every alignments track that sets no sort: is sorted there and a',
    'band marks the bases the record changes. Such a track also grows to hold',
    'its pileup, up to 250 px, so rows are the same height on every image and',
    'a deep pileup stops there with the variant reads on top; a height:,',
    'heightMode: or growMaxHeight= set on the track wins.',
    '',
    'The module graph loads once for the whole callset, so this is much faster',
    `than a shell loop over "${scriptName} breakpoint".`,
    '',
    'Options:',
    ...formatOpts(defs, pad),
    '',
    'Examples:',
    ...formatExamples(scriptName, [
      [
        'batch --sites calls.vcf.gz ref.fa tumor.bam --outDir figs --flank 1000',
        'A contact sheet of every junction in a callset',
      ],
      [
        'batch --sites calls.vcf.gz --genome hg38 tumor.bam --limit 20',
        'The first 20, to check the framing before committing to the whole run',
      ],
      [
        'batch --sites snvs.vcf.gz --genome hg38 tumor.bam --passOnly',
        'Small variants at base resolution, reads with each variant sorted to the top',
      ],
      [
        'batch --sites linx_links.bedpe --genome hg38 tumor.bam',
        'The same from a BEDPE, for a caller whose output is not a VCF',
      ],
    ]),
    '',
    'The ALT grammar is parsed by @gmod/vcf, so inserted sequence at the',
    'junction and upper-cased mate contigs are handled; reciprocal breakend',
    'pairs are merged, so each junction is queued once.',
    '',
    'Every track is drawn as if given force:true, since a window is only a flank',
    'wide and a "Region too large" panel cannot be clicked through on an image;',
    'force:false on a track restores its size limit.',
    '',
    'Records a caller files under one VCF EVENT are also drawn together, as',
    'event_<n>_<label>, when the event visits more than two loci, its contigs',
    'in the order the VCF header lists them.',
    '',
    "A manifest row's spec opens its view as a session spec: its windows,",
    'its band, and the --track tracks with the settings they were drawn with.',
    'Passed as --spec beside the same genome and track files it opens that',
    'view, without the sort and arcs a batch gives the file-flag tracks.',
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

export function appliesTo(option: OptionDef, mode: ViewMode) {
  return option.modes?.includes(mode) ?? true
}

export function optionsWithoutEffect(mode: ViewMode, given: string[]) {
  return optionDefs
    .filter(o => given.includes(o.name) && !appliesTo(o, mode))
    .map(o => o.name)
}

function buildSubcommandHelp(
  scriptName: string,
  mode: ViewMode,
  trackTypes: string[],
  syntenyTrackTypes: string[],
) {
  const { comparative } = modeDescriptors[mode]
  const defs = optionDefs.filter(o => appliesTo(o, mode))
  const pad = Math.max(...defs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} ${modeDescriptors[mode].subcommand} [options]`,
    '',
    'Options:',
    ...formatOpts(defs, pad),
    '',
    'Examples:',
    ...formatExamples(scriptName, examplesForMode(mode)),
    '',
    comparative
      ? `Comparison track options: ${syntenyTrackTypes.map(t => `--${t}`).join(', ')}`
      : `Track options: ${trackTypes.map(t => `--${t}`).join(', ')}`,
  ].join('\n')
}

export function buildHelp(
  scriptName: string,
  trackTypes: string[],
  syntenyTrackTypes: string[],
  mode?: ViewMode,
) {
  if (mode) {
    return buildSubcommandHelp(scriptName, mode, trackTypes, syntenyTrackTypes)
  }
  const subcommandNames = viewModes
    .filter(mode => mode !== 'linear')
    .map(mode => modeDescriptors[mode].subcommand)
  const pad = Math.max(...optionDefs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} [options]`,
    `       ${scriptName} <${subcommandNames.join('|')}> [options]`,
    `       ${scriptName} batch --sites <file> [options]`,
    `       ${scriptName} list [genome] [filter]`,
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
    `Other views (run "${scriptName} <view> --help" for its options): ${subcommandNames.join(', ')}`,
    '',
    `Whole callsets: "${scriptName} batch --sites calls.vcf.gz" writes one image per record (run "${scriptName} batch --help")`,
    '',
    `Discovery: "${scriptName} list" lists genomes.jbrowse.org assemblies; "${scriptName} list <genome> [filter]" lists a genome's tracks`,
  ].join('\n')
}

// The docs embed this
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
    buildBatchHelp(scriptName),
  ].join('\n\n')
}
