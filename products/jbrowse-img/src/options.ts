import { modeDescriptors, viewModes } from './modes.ts'

import type { ViewMode } from './modes.ts'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

export interface OptionDef {
  name: string
  description: string
  default?: number | boolean | string
}

export const optionDefs: OptionDef[] = [
  { name: 'fasta', description: 'Path to indexed FASTA file' },
  {
    name: 'chromSizes',
    description:
      'Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view',
  },
  { name: 'aliases', description: 'Path to reference name aliases file' },
  { name: 'assembly', description: 'Path to assembly JSON or name in config' },
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
  { name: 'config', description: 'Path to JBrowse config.json (path or URL)' },
  { name: 'session', description: 'Path to session JSON' },
  {
    name: 'loc',
    description:
      'Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)',
  },
  { name: 'out', description: 'Output file path (SVG or PNG)' },
  { name: 'width', description: 'Width of output in pixels', default: 1500 },
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
    description: 'Path to JSON file with an array of track configs',
  },
  { name: 'cytobands', description: 'Path to cytoband file for the assembly' },
  {
    name: 'themeName',
    description:
      'Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal',
  },
  {
    name: 'fontFamily',
    description:
      'Font family for all text (serif, sans-serif, monospace, or a named family)',
    default: 'serif',
  },
  {
    name: 'showGridlines',
    description: 'Show genomic coordinate gridlines in the output',
    default: false,
  },
  {
    name: 'trackLabels',
    description: 'Track label position: offset, overlay, left, or none',
  },
  {
    name: 'refseq',
    description: 'Show the reference sequence track',
    default: false,
  },
  {
    name: 'spec',
    description:
      'Session-spec JSON (inline or path to .json) describing the view; see urlparams.md. Drives N-way comparative views from a --config',
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
  },
  {
    name: 'minAlignmentLength',
    description: 'Hide alignments shorter than N bp (de-spaghetti a busy plot)',
  },
  {
    name: 'colorBy',
    description:
      'Color synteny ribbons, e.g. "query" tints by query chromosome',
  },
  { name: 'alpha', description: 'Ribbon opacity 0-1 (lower reveals density)' },
  {
    name: 'levelHeights',
    description:
      'Comma-separated pixel height per level, e.g. 300,300 (one value applies to all)',
  },
  {
    name: 'cigarMode',
    description:
      "CIGAR-level indel detail in synteny ribbons: 'off' (blocks only), 'matches' (indels see-through), or 'full' (indels colored) [default: full]",
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

export function getString(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  return typeof v === 'string' ? v : undefined
}

export function getBoolean(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  return v === true || v === 'true'
}

export function getNumber(
  rest: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const v = rest[key]
  const n = typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

export function getOptionalNumber(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  const n = typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

// A comma-separated numeric list (e.g. levelHeights:300,300), dropping any
// non-numeric entries; undefined when the flag is absent.
export function getNumberList(rest: Record<string, unknown>, key: string) {
  const v = rest[key]
  if (typeof v !== 'string') {
    return undefined
  }
  const list = v
    .split(',')
    .map(s => Number(s))
    .filter(n => Number.isFinite(n))
  return list.length ? list : undefined
}

const trackLabelModes: TrackLabelMode[] = ['offset', 'overlay', 'left', 'none']

export function getTrackLabels(rest: Record<string, unknown>) {
  const v = getString(rest, 'trackLabels')
  return trackLabelModes.find(mode => mode === v)
}

export const cigarModes = ['off', 'matches', 'full'] as const

export function getCigarMode(rest: Record<string, unknown>) {
  const v = getString(rest, 'cigarMode')
  return cigarModes.find(mode => mode === v)
}

export const knownOptions = new Set([
  ...optionDefs.map(o => o.name),
  ...comparativeOptionDefs.map(o => o.name),
  'help',
  'version',
])

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
  if (modeDescriptors[mode].comparative) {
    return comparativeExamples
  }
  return mode === 'circular' ? circularExamples : examples
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
    ? [...optionDefs, ...comparativeOptionDefs]
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
