import fs from 'fs'

import { parseArgv, standardizeArgv } from './parseArgv'
import { renderRegion } from './renderRegion'
import setupEnv from './setupEnv'
import { convert } from './util'

import type { Opts } from './renderRegion'

setupEnv()

const err = console.error
console.error = (...p: unknown[]) => {
  if (!/useLayoutEffect/.exec(`${p[0]}`)) {
    err(p)
  }
}

const warn = console.warn
console.warn = (...p: unknown[]) => {
  if (!/estimation reached timeout/.exec(`${p[0]}`)) {
    warn(p)
  }
}

function showHelp() {
  console.log(`
jb2export - Creates a jbrowse 2 image snapshot

Usage: jb2export [options]

Options:
  --config <path>         Path to config file
  --session <path>        Path to session file  
  --assembly <path>       Path to an assembly configuration, or a name of an assembly in the configFile
  --tracks <path>         Path to tracks portion of a session
  --loc <string>          A locstring to navigate to, or --loc all to view the whole genome
  --fasta <path>          Supply a fasta for the assembly
  --aliases <path>        Supply aliases for the assembly, e.g. mapping of 1 to chr1. Tab separated file where column 1 matches the names from the FASTA
  -w, --width <number>    Set the width of the window that jbrowse renders to, default: 1500px
  --pngwidth <number>     Set the width of the png canvas if using png output, default 2048px
  --configtracks <array>  A list of track labels from a config file
  --bam <path>            A bam file, flag --bam can be used multiple times to specify multiple bam files
  --bigwig <path>         A bigwig file, the --bigwig flag can be used multiple times to specify multiple bigwig files
  --cram <path>           A cram file, the --cram flag can be used multiple times to specify multiple cram files
  --vcfgz <path>          A tabixed VCF, the --vcfgz flag can be used multiple times to specify multiple vcfgz files
  --gffgz <path>          A tabixed GFF, the --gffgz can be used multiple times to specify multiple gffgz files
  --hic <path>            A .hic file, the --hic can be used multiple times to specify multiple hic files
  --bigbed <path>         A .bigBed file, the --bigbed can be used multiple times to specify multiple bigbed files
  --bedgz <path>          A bed tabix file, the --bedgz can be used multiple times to specify multiple bedtabix files
  --out <path>            File to output to. Default: out.svg. If a filename with extension .png is supplied the program will try to automatically execute rsvg-convert to convert it to png
  --noRasterize           Use full SVG rendering with no rasterized layers, this can substantially increase filesize
  --defaultSession        Use the defaultSession from config.json
  -h, --help              Show this help message
`)
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp()
  process.exit(0)
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
