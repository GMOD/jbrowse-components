import fs from 'fs'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  convert,
  parseArgv,
  renderRegion,
  setupEnv,
  standardizeArgv,
} from './index.js'

const trackTypes = [
  'bam',
  'cram',
  'bigwig',
  'vcfgz',
  'gffgz',
  'hic',
  'bigbed',
  'bedgz',
]

const yargsInstance = yargs(hideBin(process.argv))
  .scriptName('jb2export')
  .usage('$0 [options]')
  .option('fasta', {
    type: 'string',
    description: 'Path to indexed FASTA file',
  })
  .option('aliases', {
    type: 'string',
    description: 'Path to reference name aliases file',
  })
  .option('assembly', {
    type: 'string',
    description: 'Path to assembly JSON or name in config',
  })
  .option('config', {
    type: 'string',
    description: 'Path to JBrowse config.json',
  })
  .option('session', {
    type: 'string',
    description: 'Path to session JSON',
  })
  .option('loc', {
    type: 'string',
    description: 'Location to render (e.g., chr1:1-1000 or "all")',
  })
  .option('out', {
    type: 'string',
    description: 'Output file path (SVG or PNG)',
  })
  .option('width', {
    type: 'number',
    description: 'Width of output in pixels',
    default: 1500,
  })
  .option('noRasterize', {
    type: 'boolean',
    description: 'Disable rasterization of pileup/coverage',
    default: false,
  })
  .option('defaultSession', {
    type: 'boolean',
    description: 'Use default session from config',
    default: false,
  })
  .example(
    '$0 --fasta ref.fa --bam reads.bam --loc chr1:1-10000 --out out.svg',
    'Render BAM alignments',
  )
  .example(
    '$0 --fasta ref.fa --vcfgz variants.vcf.gz --loc chr1:1-50000 --out out.png',
    'Render VCF variants',
  )
  .epilogue(
    'Track options: --bam, --cram, --bigwig, --vcfgz, --gffgz, --hic, --bigbed, --bedgz',
  )
  .strict(false)
  .help()

export async function main() {
  const argv = await yargsInstance.argv
  setupEnv()

  // Parse track arguments from command line (--bam, --vcf, etc.)
  // parseArgv needs all args including values, not just flags
  const args = process.argv.slice(2)
  const parsed = parseArgv(args)
  const standardized = standardizeArgv(parsed, trackTypes)

  const opts = {
    fasta: argv.fasta,
    aliases: argv.aliases,
    assembly: argv.assembly,
    config: argv.config,
    session: argv.session,
    loc: argv.loc,
    width: argv.width as number | undefined,
    noRasterize: argv.noRasterize as boolean | undefined,
    // defaultSession in Opts is string|undefined but used as boolean flag
    defaultSession: argv.defaultSession ? 'true' : undefined,
    trackList: standardized.trackList,
  }

  const result = await renderRegion(opts)
  const outFile = argv.out || standardized.out

  if (!outFile) {
    console.log(result)
  } else if (outFile.endsWith('.png')) {
    convert(result, { out: outFile, pngwidth: String(argv.width || 2048) })
  } else {
    fs.writeFileSync(outFile, result)
  }
}
