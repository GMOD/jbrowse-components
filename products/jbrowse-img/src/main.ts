import fs from 'node:fs'

import {
  exportBooleanFlags,
  hasComparativeArgs,
  isDataFile,
  parseArgv,
  standardizeArgv,
  viewSettings,
} from '@jbrowse/launch-args'

import { runList } from './list.ts'
import { syntenyTrackTypes, trackTypes } from './makeConfigs.ts'
import { subcommandMode, subcommandTokens } from './modes.ts'
import {
  DEFAULT_WIDTH,
  batchDroppedOptions,
  batchOptionNames,
  buildBatchHelp,
  buildHelp,
  getBoolean,
  getFormat,
  getNumber,
  getOptionalCount,
  getString,
  getThemeMode,
  getThemeName,
  getTrackLabels,
  knownOptions,
} from './options.ts'
import { writeRendered } from './util.ts'

// Everything that draws is imported where it is first needed. Loading it is
// about three seconds of a process's start, which --help, --version, `list`
// and `batch --dryRun` have no use for, and the process that hands a --jobs run
// to its workers draws nothing itself.

const scriptName = 'jb2export'

async function main() {
  const argv = process.argv.slice(2)
  // A leading word (not a --flag or a data file) selects a subcommand, e.g.
  // `jb2export dotplot --fasta a.fa --fasta b.fa ...`
  const first = argv[0]
  const isSubcommand =
    first !== undefined && !first.startsWith('-') && !isDataFile(first)
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
    // to the network for a genome literally named "--help"
    console.log(
      first === 'batch'
        ? buildBatchHelp(scriptName)
        : buildHelp(scriptName, trackTypes, syntenyTrackTypes, mode),
    )
  } else if (first === 'list') {
    // a text-only discovery command (no rendering): `list` prints the hosted
    // assemblies, `list <genome> [filter]` prints that genome's tracks
    console.log(await runList(argv.slice(1)))
  } else if (args.includes('--version') || args.includes('-v')) {
    const { version } = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    console.log(version)
  } else {
    const parsed = parseArgv(args, { booleans: exportBooleanFlags })
    // a comparative view's --genome rows are read from the entries
    const { trackList, ...rest } = standardizeArgv(
      parsed,
      [...trackTypes, ...syntenyTrackTypes],
      {
        repeatable: [
          'track',
          'fasta',
          'chromSizes',
          ...(mode === 'breakpoint' ? ['loc'] : []),
          ...(hasComparativeArgs(parsed) ? ['genome'] : []),
        ],
      },
    )
    const showTracks = parsed.filter(([key]) => key === 'track')

    for (const key of Object.keys(rest)) {
      if (!knownOptions.has(key)) {
        console.warn(`Warning: unknown option "--${key}"`)
      }
    }

    if (first !== 'batch') {
      const batchOnly = batchOptionNames.filter(name => name in rest)
      if (batchOnly.length) {
        console.warn(
          `Warning: ${batchOnly.map(name => `--${name}`).join(', ')} ${batchOnly.length > 1 ? 'have' : 'has'} no effect without the batch subcommand`,
        )
      }
    }

    const width = getNumber(rest, 'width', DEFAULT_WIDTH)
    const renderOpts = {
      assembly: getString(rest, 'assembly'),
      genome: getString(rest, 'genome'),
      config: getString(rest, 'config'),
      session: getString(rest, 'session'),
      showTracks,
      loc: getString(rest, 'loc'),
      width,
      noRasterize: getBoolean(rest, 'noRasterize'),
      defaultSession: getBoolean(rest, 'defaultSession'),
      tracks: getString(rest, 'tracks'),
      themeName: getThemeName(rest),
      themeMode: getThemeMode(rest),
      fontFamily: getString(rest, 'fontFamily'),
      showGridlines: getBoolean(rest, 'showGridlines'),
      trackLabels: getTrackLabels(rest),
      refseq: getBoolean(rest, 'refseq'),
      mode,
      argv: parsed,
      view: viewSettings(parsed.find(([key]) => key === 'view')?.[1] ?? []),
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
      const { parseShard, runBatch } = await import('./runBatch.ts')
      const { failures } = await runBatch({
        ...renderOpts,
        sites: getString(rest, 'sites'),
        outDir: getString(rest, 'outDir') ?? 'jb2export-batch',
        flank: getOptionalCount(rest, 'flank'),
        limit: getOptionalCount(rest, 'limit'),
        format: getFormat(rest) ?? 'png',
        passOnly: getBoolean(rest, 'passOnly'),
        resume: getBoolean(rest, 'resume'),
        manifest: getBoolean(rest, 'manifest'),
        dryRun: getBoolean(rest, 'dryRun'),
        jobs: getOptionalCount(rest, 'jobs'),
        respawn: {
          command: process.execPath,
          args: [...process.execArgv, ...process.argv.slice(1)],
        },
        shard: parseShard(getString(rest, 'shard')),
      })
      // A partial run is reported as one: the images are still there and worth
      // keeping, but a script that treats this as success would be wrong about
      // how much of its callset it just reviewed.
      if (failures.length) {
        process.exitCode = 1
      }
    } else {
      const { setupEnv } = await import('./setupEnv.ts')
      setupEnv()
      const { renderRegion } = await import('./renderRegion.ts')
      writeRendered(
        await renderRegion(renderOpts),
        getString(rest, 'out'),
        width,
      )
    }
  }
}

let finished = false

// beforeExit fires only when the event loop empties, so an unfinished run here
// is a promise that never settles; Node would otherwise exit 0 silently
process.on('beforeExit', () => {
  if (!finished) {
    console.error(
      `${scriptName}: the run did not finish; exiting without output`,
    )
    process.exitCode = 1
  }
})

main()
  .then(() => {
    finished = true
  })
  .catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
