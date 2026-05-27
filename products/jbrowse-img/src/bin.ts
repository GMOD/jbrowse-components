#!/usr/bin/env node

import fs from 'fs'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  convert,
  parseArgv,
  renderRegion,
  setupEnv,
  standardizeArgv,
  trackTypes,
} from './index.ts'

const knownOptions = new Set([
  ...trackTypes,
  'fasta',
  'aliases',
  'assembly',
  'config',
  'session',
  'loc',
  'out',
  'width',
  'noRasterize',
  'defaultSession',
  'tracks',
  'cytobands',
  'themeName',
  'showGridlines',
  'trackLabels',
  'refseq',
  'help',
  'version',
])

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
  .option('tracks', {
    type: 'string',
    description: 'Path to JSON file with an array of track configs',
  })
  .option('cytobands', {
    type: 'string',
    description: 'Path to cytoband file for the assembly',
  })
  .option('themeName', {
    type: 'string',
    description: 'Theme name for rendering (e.g. default, dark)',
  })
  .option('showGridlines', {
    type: 'boolean',
    description: 'Show genomic coordinate gridlines in the output',
    default: false,
  })
  .option('trackLabels', {
    type: 'string',
    description: 'Track label position: offset, overlapping, or hidden',
  })
  .option('refseq', {
    type: 'boolean',
    description: 'Show the reference sequence track',
    default: false,
  })
  .example(
    '$0 --fasta ref.fa --bam reads.bam --loc chr1:1-10000 --out out.svg',
    'Render BAM alignments to SVG',
  )
  .example(
    '$0 --fasta ref.fa --vcfgz variants.vcf.gz --loc chr1:1-50000 --out out.png',
    'Render VCF variants to PNG',
  )
  .example(
    '$0 --fasta ref.fa --bam reads.bam height:80 color:strand --loc chr1:1-10000 --out out.svg',
    'Custom track height and strand coloring',
  )
  .example(
    '$0 --config jbrowse.json --assembly hg38 --tracks tracks.json --loc chr1:1-100000 --out out.svg',
    'Render from config with a JSON tracks file',
  )
  .example(
    '$0 --fasta ref.fa.gz --cytobands cytobands.bed --bigwig signal.bw --loc chr1 --out out.svg',
    'Render BigWig with cytobands',
  )
  .epilogue(`Track options: ${trackTypes.map(t => `--${t}`).join(', ')}`)
  .strict(false)
  .help()

async function main() {
  const argv = await yargsInstance.argv
  setupEnv()

  const args = process.argv.slice(2)
  const parsed = parseArgv(args)
  const { trackList } = standardizeArgv(parsed, trackTypes)

  for (const [key] of parsed) {
    if (!knownOptions.has(key)) {
      console.warn(`Warning: unknown option "--${key}"`)
    }
  }

  const opts = {
    fasta: argv.fasta,
    aliases: argv.aliases,
    assembly: argv.assembly,
    config: argv.config,
    session: argv.session,
    loc: argv.loc,
    width: argv.width,
    noRasterize: argv.noRasterize,
    defaultSession: argv.defaultSession,
    tracks: argv.tracks,
    cytobands: argv.cytobands,
    themeName: argv.themeName,
    showGridlines: argv.showGridlines,
    trackLabels: argv.trackLabels,
    refseq: argv.refseq,
    trackList,
  }

  const result = await renderRegion(opts)
  const outFile = argv.out

  if (!outFile) {
    console.log(result)
  } else if (outFile.endsWith('.png')) {
    convert(result, { out: outFile, pngwidth: String(argv.width) })
  } else {
    fs.writeFileSync(outFile, result)
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
