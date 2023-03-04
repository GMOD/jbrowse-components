import fs from 'fs'
import yargs from 'yargs'
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only'
import fetch, { Headers, Response, Request } from 'node-fetch'
import { JSDOM } from 'jsdom'
import { Image, createCanvas } from 'canvas'

// locals
import { standardizeArgv, parseArgv } from './parseArgv'
import { renderRegion, Opts } from './renderRegion'
import { convert } from './util'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const { document } = new JSDOM(`...`).window
global.document = document

// force use of node-fetch polyfill, even if node 18+ fetch is available.
// native node 18+ fetch currently gives errors related to unidici and
// Uint8Array:
//
//
// % node --version
// v18.12.1
//
// % jb2export --fasta https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.fa --bam https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam --loc ctgA:1-1000 --out out4.svg
// [
//   '(node:1387934) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time\n' +
//     '(Use `node --trace-warnings ...` to show where the warning was created)'
// ]
// [
//   RangeError: offset is out of bounds
//       at Uint8Array.set (<anonymous>)
//       at Response.arrayBuffer (node:internal/deps/undici/undici:6117:23)
//       at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
// ]

// @ts-expect-error
global.fetch = fetch
// @ts-expect-error
global.Headers = Headers
// @ts-expect-error
global.Response = Response
// @ts-expect-error
global.Request = Request

const err = console.error
console.error = (...p: unknown[]) => {
  if (!`${p[0]}`.match('useLayoutEffect')) {
    err(p)
  }
}

const warn = console.warn
console.warn = (...p: unknown[]) => {
  if (!`${p[0]}`.match('estimation reached timeout')) {
    warn(p)
  }
}

// note: yargs is actually unused except for printing help
// we do custom command line parsing, see parseArgv.ts
// eslint-disable-next-line @typescript-eslint/no-floating-promises
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

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  try {
    const result = await renderRegion(args as Opts)
    const { out = 'out.svg', pngwidth = '2048' } = args
    if (out.endsWith('.png')) {
      convert(result, { out, pngwidth })
    } else if (out.endsWith('.pdf')) {
      convert(result, { out, pngwidth }, ['-f', 'pdf'])
    } else {
      fs.writeFileSync(out, result)
    }

    // manually exit the process after done rendering because autoruns or
    // something similar otherwise keeps the nodejs process alive xref
    // https://github.com/GMOD/jb2export/issues/6
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
})()
