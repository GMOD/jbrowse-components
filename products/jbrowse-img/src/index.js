/* eslint-disable no-console */
import fs from 'fs'
import yargs from 'yargs'
import { standardizeArgv, parseArgv } from './parseArgv'
import { renderRegion } from './renderRegion'
import tmp from 'tmp'

import { spawnSync } from 'child_process'

// eslint-disable-next-line no-unused-expressions
yargs
  .command('jb2export', 'Creates a jbrowse 2 image snapshot')
  .option('config', {
    description: 'Path to config file',
    type: 'string',
  })
  .option('session', {
    description: 'Path to session file',
    type: 'string',
  })
  .option('assembly', {
    description:
      'Path to an assembly configuration, or a name of an assembly in the configFile',
    type: 'string',
  })
  .option('tracks', {
    description: 'Path to tracks portion of a session',
    type: 'string',
  })
  .option('loc', {
    description:
      'A locstring to navigate to, or --loc all to view the whole genome',
    type: 'string',
  })
  .option('fasta', {
    description: 'Supply a fasta for the assembly',
    type: 'string',
  })
  .option('aliases', {
    description:
      'Supply aliases for the assembly, e.g. mapping of 1 to chr1. Tab separated file where column 1 matches the names from the FASTA',
    type: 'string',
  })
  .option('width', {
    description:
      'Set the width of the window that jbrowse renders to, default: 1500px',
    type: 'number',
  })
  .option('pngwidth', {
    description:
      'Set the width of the png canvas if using png output, default 2048px',
    type: 'number',
    default: 2048,
  })
  // track types
  .option('configtracks', {
    description: 'A list of track labels from a config file',
    type: 'array',
  })
  .option('bam', {
    description:
      'A bam file, flag --bam can be used multiple times to specify multiple bam files',
    type: 'array',
  })
  .option('bigwig', {
    description:
      'A bigwig file, the --bigwig flag can be used multiple times to specify multiple bigwig files',
    type: 'array',
  })
  .option('cram', {
    description:
      'A cram file, the --cram flag can be used multiple times to specify multiple cram files',
    type: 'array',
  })
  .option('vcfgz', {
    description:
      'A tabixed VCF, the --vcfgz flag can be used multiple times to specify multiple vcfgz files',
    type: 'array',
  })
  .option('gffgz', {
    description:
      'A tabixed GFF, the --gffgz can be used multiple times to specify multiple gffgz files',
    type: 'array',
  })
  .option('hic', {
    description:
      'A .hic file, the --hic can be used multiple times to specify multiple hic files',
    type: 'array',
  })
  .option('bigbed', {
    description:
      'A .bigBed file, the --bigbed can be used multiple times to specify multiple bigbed files',
    type: 'array',
  })
  .option('bedgz', {
    description:
      'A bed tabix file, the --bedgz can be used multiple times to specify multiple bedtabix files',
    type: 'array',
  })

  // other
  .option('out', {
    description:
      'File to output to. Default: out.svg. If a filename with extension .png is supplied the program will try to automatically execute rsvg-convert to convert it to png',
    type: 'string',
    default: 'out.svg',
  })
  .option('noRasterize', {
    description:
      'Use full SVG rendering with no rasterized layers, this can substantially increase filesize',
    type: 'boolean',
  })
  .option('defaultSession', {
    description: 'Use the defaultSession from config.json',
    type: 'boolean',
  })
  .help()
  .alias('help', 'h')
  .alias('width', 'w').argv

// prints to stderr the time it takes to execute cb
async function time(cb) {
  const start = +Date.now()
  const ret = await cb()
  console.log(`Finished rendering: ${(+Date.now() - start) / 1000}s`)
  return ret
}

const args = standardizeArgv(parseArgv(process.argv.slice(2)), [
  'bam',
  'cram',
  'vcfgz',
  'hic',
  'bigwig',
  'bigbed',
  'bedgz',
  'gffgz',
  'configtracks',
])

time(() =>
  renderRegion(args).then(result => {
    const outfile = args.out || 'out.svg'
    if (outfile.endsWith('.png')) {
      const tmpobj = tmp.fileSync({
        mode: 0o644,
        prefix: 'prefix-',
        postfix: '.svg',
      })
      fs.writeFileSync(tmpobj.name, result)
      const ls = spawnSync('rsvg-convert', [
        '-w',
        args.pngwidth || 2048,
        tmpobj.name,
        '-o',
        outfile,
      ])

      console.log(`rsvg-convert stderr: ${ls.stderr.toString()}`)
      console.log(`rsvg-convert stdout: ${ls.stdout.toString()}`)
      fs.unlinkSync(tmpobj.name)
    } else if (outfile.endsWith('.pdf')) {
      const tmpobj = tmp.fileSync({
        mode: 0o644,
        prefix: 'prefix-',
        postfix: '.svg',
      })
      fs.writeFileSync(tmpobj.name, result)
      const ls = spawnSync('rsvg-convert', [
        '-w',
        args.pngwidth || 2048,
        tmpobj.name,
        '-f',
        'pdf',
        '-o',
        outfile,
      ])

      console.log(`rsvg-convert stderr: ${ls.stderr.toString()}`)
      console.log(`rsvg-convert stdout: ${ls.stdout.toString()}`)
      fs.unlinkSync(tmpobj.name)
    } else {
      fs.writeFileSync(outfile, result)
    }
  }, console.error),
)
