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
]

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
  return v === 'offset' || v === 'overlay' || v === 'left' || v === 'none'
    ? v
    : undefined
}

export const knownOptions = new Set([
  ...optionDefs.map(o => o.name),
  'help',
  'version',
])

export function buildHelp(scriptName: string, trackTypes: string[]) {
  const pad = Math.max(...optionDefs.map(o => o.name.length))
  const optLines = optionDefs.map(o => {
    const suffix = o.default === undefined ? '' : ` [default: ${o.default}]`
    return `  --${o.name.padEnd(pad)}  ${o.description}${suffix}`
  })
  const exampleLines = examples.map(
    ([cmd, desc]) => `  ${scriptName} ${cmd}\n      ${desc}`,
  )
  return [
    `Usage: ${scriptName} [options]`,
    '',
    'Options:',
    ...optLines,
    `  --${'help'.padEnd(pad)}  Show help`,
    `  --${'version'.padEnd(pad)}  Print version`,
    '',
    'Examples:',
    ...exampleLines,
    '',
    `Track options: ${trackTypes.map(t => `--${t}`).join(', ')}`,
  ].join('\n')
}
