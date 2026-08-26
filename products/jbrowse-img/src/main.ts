import fs from 'node:fs'

import {
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
  batchDroppedOptions,
  buildBatchHelp,
  buildHelp,
  comparativeOptionNames,
  getBoolean,
  getCigarMode,
  getColorBy,
  getFormat,
  getNumber,
  getNumberList,
  getOptionalCount,
  getOptionalNumber,
  getString,
  getThemeName,
  getTrackLabels,
  ignoredComparativeOptions,
  knownOptions,
  wantsRScript,
} from './options.ts'
import { runBatch } from './runBatch.ts'
import { writeRendered } from './util.ts'

const scriptName = 'jb2export'

async function main() {
  const argv = process.argv.slice(2)
  // A leading positional token (not a --flag) selects a subcommand, e.g.
  // `jb2export dotplot --fasta a.fa --fasta2 b.fa ...`
  const first = argv[0]
  const isSubcommand = first !== undefined && !first.startsWith('-')
  const mode = isSubcommand ? subcommandMode(first) : undefined
  const args = isSubcommand ? argv.slice(1) : argv

  if (isSubcommand && !mode && first !== 'list' && first !== 'batch') {
    console.error(
      `Unknown subcommand "${first}". Known subcommands: ${subcommandTokens.join(', ')}, list, batch`,
    )
    process.exit(1)
  } else if (
    argv.length === 0 ||
    args.includes('--help') ||
    args.includes('-h')
  ) {
    // ahead of `list`, so `jb2export list --help` prints help rather than going
    // to the network for a hub literally named "--help"
    console.log(
      first === 'batch'
        ? buildBatchHelp(scriptName)
        : buildHelp(scriptName, trackTypes, syntenyTrackTypes, mode),
    )
  } else if (first === 'list') {
    // a text-only discovery command (no rendering): `list` prints the hosted
    // assemblies, `list <hub> [filter]` prints that hub's tracks
    console.log(await runList(argv.slice(1)))
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
    } else if (mode) {
      // Under a comparative subcommand, the flags the OTHER comparative mode
      // owns are still parsed but never reach that view's init (a dotplot has no
      // ribbon shape, so --drawCurves/--cigarMode/--alpha/--levelHeights do
      // nothing there). Name them instead of dropping them silently.
      const ignored = ignoredComparativeOptions(mode).filter(
        name => name in rest,
      )
      if (ignored.length) {
        console.warn(
          `Warning: ${ignored.map(name => `--${name}`).join(', ')} ${ignored.length > 1 ? 'have' : 'has'} no effect on a ${modeDescriptors[mode].subcommand} view`,
        )
      }
    }

    const width = getNumber(rest, 'width', DEFAULT_WIDTH)
    const outFile = getString(rest, 'out')
    const renderOpts = {
      emitR: wantsRScript(outFile),
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
      fontFamily: getString(rest, 'fontFamily'),
      showGridlines: getBoolean(rest, 'showGridlines'),
      trackLabels: getTrackLabels(rest),
      refseq: getBoolean(rest, 'refseq'),
      mode,
      argv: parsed,
      autoDiagonalize: getBoolean(rest, 'autoDiagonalize'),
      drawCurves: getBoolean(rest, 'drawCurves'),
      minAlignmentLength: getOptionalNumber(rest, 'minAlignmentLength'),
      colorBy: getColorBy(rest),
      alpha: getOptionalNumber(rest, 'alpha'),
      levelHeights: getNumberList(rest, 'levelHeights'),
      cigarMode: getCigarMode(rest),
      showColorLegend: getBoolean(rest, 'showColorLegend'),
      spec: getString(rest, 'spec'),
      trackList,
    }

    if (first === 'batch') {
      // --spec/--session are refused inside runBatch, which is handed them and
      // so can say so to a library caller too
      const dropped = batchDroppedOptions.filter(name => name in rest)
      if (dropped.length) {
        console.warn(
          `Warning: batch ignores ${dropped.map(n => `--${n}`).join(', ')}; --outDir names the directory and the junction file says where to look`,
        )
      }
      const { failures } = await runBatch({
        ...renderOpts,
        bedpe: getString(rest, 'bedpe'),
        vcf: getString(rest, 'vcf'),
        outDir: getString(rest, 'outDir') ?? 'jb2export-batch',
        flank: getOptionalCount(rest, 'flank') ?? 500,
        limit: getOptionalCount(rest, 'limit'),
        format: getFormat(rest) ?? 'png',
        passOnly: getBoolean(rest, 'passOnly'),
        resume: getBoolean(rest, 'resume'),
        manifest: getBoolean(rest, 'manifest'),
        dryRun: getBoolean(rest, 'dryRun'),
      })
      // A partial run is reported as one: the images are still there and worth
      // keeping, but a script that treats this as success would be wrong about
      // how much of its callset it just reviewed.
      if (failures.length) {
        process.exitCode = 1
      }
    } else {
      writeRendered(await renderRegion(renderOpts), outFile, width)
    }
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
