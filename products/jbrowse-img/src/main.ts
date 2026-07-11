import fs from 'node:fs'

import {
  convert,
  parseArgv,
  renderRegion,
  setupEnv,
  standardizeArgv,
  syntenyTrackTypes,
  trackTypes,
} from './index.ts'
import { runList } from './list.ts'
import { modeDescriptors, subcommandMode, subcommandTokens } from './modes.ts'
import {
  DEFAULT_WIDTH,
  buildHelp,
  comparativeOptionNames,
  getBoolean,
  getCigarMode,
  getNumber,
  getNumberList,
  getOptionalNumber,
  getString,
  getThemeName,
  getTrackLabels,
  knownOptions,
} from './options.ts'

const scriptName = 'jb2export'

// Write the rendered SVG: to stdout when no --out, else by extension. .png/.pdf
// route through rsvg-convert (.pdf via the `-f pdf` flag); anything else is the
// raw SVG. Both raster formats honor --width so PDF matches PNG.
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
      convert(result, { out: outFile, width: String(width) })
    } else if (lower.endsWith('.pdf')) {
      convert(result, { out: outFile, width: String(width) }, ['-f', 'pdf'])
    } else {
      fs.writeFileSync(outFile, result)
    }
  }
}

async function main() {
  const argv = process.argv.slice(2)
  // A leading positional token (not a --flag) selects a subcommand, e.g.
  // `jb2export dotplot --fasta a.fa --fasta2 b.fa ...`
  const first = argv[0]
  const isSubcommand = first !== undefined && !first.startsWith('-')
  const mode = isSubcommand ? subcommandMode(first) : undefined
  const args = isSubcommand ? argv.slice(1) : argv

  // `list` is a text-only discovery command (no rendering), so it's handled
  // ahead of the render path: `list` prints hosted assemblies, `list <hub>
  // [filter]` prints that hub's tracks.
  if (first === 'list') {
    console.log(await runList(argv.slice(1)))
  } else if (isSubcommand && !mode) {
    console.error(
      `Unknown subcommand "${first}". Known subcommands: ${subcommandTokens.join(', ')}, list`,
    )
    process.exit(1)
  } else if (
    argv.length === 0 ||
    args.includes('--help') ||
    args.includes('-h')
  ) {
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
    // --track is repeatable and carries its own [id, ...modifiers], so it's read
    // from the raw entries rather than the collapsed `rest` (which keeps only the
    // last value of a repeated flag).
    const showTracks = parsed.filter(([key]) => key === 'track')

    for (const key of Object.keys(rest)) {
      if (!knownOptions.has(key)) {
        console.warn(`Warning: unknown option "--${key}"`)
      }
    }

    // The comparative flags (--fasta2/--loc2/...) only take effect under a
    // comparative subcommand or a comparative --spec; warn rather than silently
    // ignore them in a plain linear render.
    const comparativeMode = mode ? modeDescriptors[mode].comparative : false
    if (
      !comparativeMode &&
      !getString(rest, 'spec') &&
      comparativeOptionNames.some(name => name in rest)
    ) {
      console.warn(
        'Warning: comparative options (e.g. --fasta2, --loc2) have no effect without the dotplot or synteny subcommand',
      )
    }

    const width = getNumber(rest, 'width', DEFAULT_WIDTH)
    const result = await renderRegion({
      fasta: getString(rest, 'fasta'),
      aliases: getString(rest, 'aliases'),
      assembly: getString(rest, 'assembly'),
      hub: getString(rest, 'hub'),
      config: getString(rest, 'config'),
      session: getString(rest, 'session'),
      showTracks,
      loc: getString(rest, 'loc'),
      width,
      noRasterize: getBoolean(rest, 'noRasterize'),
      defaultSession: getBoolean(rest, 'defaultSession'),
      tracks: getString(rest, 'tracks'),
      cytobands: getString(rest, 'cytobands'),
      themeName: getThemeName(rest),
      fontFamily: getString(rest, 'fontFamily') ?? 'serif',
      showGridlines: getBoolean(rest, 'showGridlines'),
      trackLabels: getTrackLabels(rest),
      refseq: getBoolean(rest, 'refseq'),
      mode,
      argv: parsed,
      autoDiagonalize: getBoolean(rest, 'autoDiagonalize'),
      drawCurves: getBoolean(rest, 'drawCurves'),
      minAlignmentLength: getOptionalNumber(rest, 'minAlignmentLength'),
      colorBy: getString(rest, 'colorBy'),
      alpha: getOptionalNumber(rest, 'alpha'),
      levelHeights: getNumberList(rest, 'levelHeights'),
      cigarMode: getCigarMode(rest),
      showColorLegend: getBoolean(rest, 'showColorLegend'),
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
