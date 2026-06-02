#!/usr/bin/env node

import fs from 'fs'

import {
  convert,
  parseArgv,
  renderRegion,
  setupEnv,
  standardizeArgv,
  trackTypes,
} from './index.ts'
import {
  buildHelp,
  getBoolean,
  getNumber,
  getString,
  getTrackLabels,
  knownOptions,
} from './options.ts'

const scriptName = 'jb2export'

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(buildHelp(scriptName, trackTypes))
  } else if (args.includes('--version') || args.includes('-v')) {
    const { version } = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    console.log(version)
  } else {
    setupEnv()

    const parsed = parseArgv(args)
    const { trackList, ...rest } = standardizeArgv(parsed, trackTypes)

    for (const key of Object.keys(rest)) {
      if (!knownOptions.has(key)) {
        console.warn(`Warning: unknown option "--${key}"`)
      }
    }

    const width = getNumber(rest, 'width', 1500)
    const result = await renderRegion({
      fasta: getString(rest, 'fasta'),
      aliases: getString(rest, 'aliases'),
      assembly: getString(rest, 'assembly'),
      config: getString(rest, 'config'),
      session: getString(rest, 'session'),
      loc: getString(rest, 'loc'),
      width,
      noRasterize: getBoolean(rest, 'noRasterize'),
      defaultSession: getBoolean(rest, 'defaultSession'),
      tracks: getString(rest, 'tracks'),
      cytobands: getString(rest, 'cytobands'),
      themeName: getString(rest, 'themeName'),
      showGridlines: getBoolean(rest, 'showGridlines'),
      trackLabels: getTrackLabels(rest),
      refseq: getBoolean(rest, 'refseq'),
      trackList,
    })

    const outFile = getString(rest, 'out')
    if (!outFile) {
      console.log(result)
    } else {
      const lower = outFile.toLowerCase()
      if (lower.endsWith('.png')) {
        convert(result, { out: outFile, pngwidth: String(width) })
      } else if (lower.endsWith('.pdf')) {
        convert(result, { out: outFile }, ['-f', 'pdf'])
      } else {
        fs.writeFileSync(outFile, result)
      }
    }
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
