import fs from 'fs'

import {
  convert,
  parseArgv,
  renderRegion,
  setupEnv,
  standardizeArgv,
  syntenyTrackTypes,
  trackTypes,
} from './index.ts'
import {
  buildHelp,
  getBoolean,
  getNumber,
  getString,
  getTrackLabels,
  knownOptions,
  subcommands,
} from './options.ts'

const scriptName = 'jb2export'

// Write the rendered SVG: to stdout when no --out, else by extension. .png/.pdf
// route through rsvg-convert (.pdf via the `-f pdf` flag); anything else is the
// raw SVG.
function writeOutput(
  result: string,
  outFile: string | undefined,
  width: number,
) {
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

async function main() {
  const argv = process.argv.slice(2)
  // A leading positional token (not a --flag) selects a comparative
  // subcommand, e.g. `jb2export dotplot --fasta a.fa --fasta2 b.fa ...`
  const first = argv[0]
  const isSubcommand = first !== undefined && !first.startsWith('-')
  const mode = isSubcommand ? subcommands[first] : undefined
  const args = isSubcommand ? argv.slice(1) : argv

  if (isSubcommand && !mode) {
    console.error(
      `Unknown subcommand "${first}". Known subcommands: ${Object.keys(subcommands).join(', ')}`,
    )
    process.exit(1)
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(buildHelp(scriptName, trackTypes, syntenyTrackTypes, mode))
  } else if (args.includes('--version') || args.includes('-v')) {
    const { version } = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    console.log(version)
  } else {
    setupEnv()

    const parsed = parseArgv(args)
    const { trackList, ...rest } = standardizeArgv(parsed, [
      ...trackTypes,
      ...syntenyTrackTypes,
    ])

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
      mode,
      fasta2: getString(rest, 'fasta2'),
      aliases2: getString(rest, 'aliases2'),
      assembly2: getString(rest, 'assembly2'),
      loc2: getString(rest, 'loc2'),
      spec: getString(rest, 'spec'),
      trackList,
    })

    writeOutput(result, getString(rest, 'out'), width)
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
