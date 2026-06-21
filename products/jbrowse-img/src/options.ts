import { modeDescriptors, viewModes } from './modes.ts'

import type { ViewMode } from './modes.ts'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

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
    description:
      'Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal',
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
  {
    name: 'autoDiagonalize',
    description:
      "Reorder the second assembly's chromosomes for least overlap (a clean diagonal)",
    default: false,
  },
  {
    name: 'drawCurves',
    description: 'Draw synteny ribbons as bezier curves instead of trapezoids',
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
  const n = typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

const trackLabelModes: TrackLabelMode[] = ['offset', 'overlay', 'left', 'none']

export function getTrackLabels(rest: Record<string, unknown>) {
  const v = getString(rest, 'trackLabels')
  return trackLabelModes.find(mode => mode === v)
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
