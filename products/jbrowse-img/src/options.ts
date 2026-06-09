import type { ViewMode } from './readData.ts'

export interface OptionDef {
  name: string
  description: string
  default?: number | boolean
}

export const optionDefs: OptionDef[] = [
  { name: 'fasta', description: 'Path to indexed FASTA file' },
  { name: 'aliases', description: 'Path to reference name aliases file' },
  { name: 'assembly', description: 'Path to assembly JSON or name in config' },
  { name: 'config', description: 'Path to JBrowse config.json' },
  { name: 'session', description: 'Path to session JSON' },
  {
    name: 'loc',
    description: 'Location to render (e.g., chr1:1-1000 or "all")',
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
    description: 'Theme name for rendering (e.g. default, dark)',
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

// Extra options accepted only by the comparative subcommands (dotplot/synteny),
// where the second assembly is rendered against the primary --fasta/--loc.
const comparativeOptionDefs: OptionDef[] = [
  { name: 'fasta2', description: 'Second assembly indexed FASTA' },
  { name: 'aliases2', description: 'Reference name aliases for fasta2' },
  { name: 'assembly2', description: 'Second assembly name in config' },
  { name: 'loc2', description: 'Location on the second assembly' },
]

// Map of subcommand name -> view mode it renders.
export const subcommands: Record<string, ViewMode> = {
  dotplot: 'dotplot',
  synteny: 'synteny',
  circular: 'circular',
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
    'synteny --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --loc chr1 --loc2 chr1 --out out.svg',
    'Linear synteny view of a region in each assembly',
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
  return typeof v === 'string' ? Number(v) : fallback
}

export function getTrackLabels(rest: Record<string, unknown>) {
  const v = getString(rest, 'trackLabels')
  return ['offset', 'overlay', 'left', 'none'].includes(v) ? v : undefined
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

// Help for a subcommand. Dotplot/synteny compare two assemblies (second-assembly
// options + comparison file types); circular is single-assembly.
function buildSubcommandHelp(
  scriptName: string,
  mode: ViewMode,
  syntenyTrackTypes: string[],
) {
  const comparative = mode === 'dotplot' || mode === 'synteny'
  const defs = comparative
    ? [...optionDefs, ...comparativeOptionDefs]
    : optionDefs
  const pad = Math.max(...defs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} ${mode} [options]`,
    '',
    'Options:',
    ...formatOpts(defs, pad),
    '',
    'Examples:',
    ...formatExamples(
      scriptName,
      comparative ? comparativeExamples : circularExamples,
    ),
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
  const pad = Math.max(...optionDefs.map(o => o.name.length))
  return [
    `Usage: ${scriptName} [options]`,
    `       ${scriptName} <${Object.keys(subcommands).join('|')}> [options]`,
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
    `Comparative subcommands (run "${scriptName} dotplot --help"): ${Object.keys(
      subcommands,
    ).join(', ')}`,
  ].join('\n')
}
