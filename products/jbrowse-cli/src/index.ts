#!/usr/bin/env node
import { parseArgs } from 'node:util'

// Command imports
import { run as addAssemblyRun } from './commands/add-assembly/index.ts'
import { run as addConnectionRun } from './commands/add-connection.ts'
import { run as addTrackJsonRun } from './commands/add-track-json.ts'
import { run as addTrackRun } from './commands/add-track.ts'
import { run as adminServerRun } from './commands/admin-server/index.ts'
import { run as createRun } from './commands/create.ts'
import { run as makePIFRun } from './commands/make-pif/index.ts'
import { run as removeTrackRun } from './commands/remove-track.ts'
import { run as setDefaultSessionRun } from './commands/set-default-session.ts'
import { run as sortBedRun } from './commands/sort-bed.ts'
import { run as sortGffRun } from './commands/sort-gff.ts'
import { run as textIndexRun } from './commands/text-index/index.ts'
import { run as upgradeRun } from './commands/upgrade.ts'
import { version } from './version.ts'

// single source of truth for both dispatch and the global help listing, so a
// new command can never be wired into one but forgotten in the other
const registry: {
  name: string
  summary: string
  run: (args: string[]) => Promise<void>
}[] = [
  {
    name: 'create',
    summary: 'Downloads and installs the latest JBrowse 2 release',
    run: createRun,
  },
  {
    name: 'add-assembly',
    summary: 'Add an assembly to a JBrowse 2 configuration',
    run: addAssemblyRun,
  },
  {
    name: 'add-track',
    summary: 'Add a track to a JBrowse 2 configuration',
    run: addTrackRun,
  },
  {
    name: 'text-index',
    summary: 'Make a text-indexing file for any given track(s)',
    run: textIndexRun,
  },
  {
    name: 'admin-server',
    summary: 'Start up a small admin server for JBrowse configuration',
    run: adminServerRun,
  },
  {
    name: 'upgrade',
    summary: 'Upgrades JBrowse 2 to latest version',
    run: upgradeRun,
  },
  {
    name: 'make-pif',
    summary: 'Creates pairwise indexed PAF (PIF), with bgzip and tabix',
    run: makePIFRun,
  },
  {
    name: 'sort-gff',
    summary: 'Helper utility to sort GFF files for tabix',
    run: sortGffRun,
  },
  {
    name: 'sort-bed',
    summary: 'Helper utility to sort BED files for tabix',
    run: sortBedRun,
  },
  {
    name: 'add-connection',
    summary: 'Add a connection to a JBrowse 2 configuration',
    run: addConnectionRun,
  },
  {
    name: 'add-track-json',
    summary: 'Add a track configuration directly from a JSON hunk',
    run: addTrackJsonRun,
  },
  {
    name: 'remove-track',
    summary: 'Remove a track configuration from a JBrowse 2 configuration',
    run: removeTrackRun,
  },
  {
    name: 'set-default-session',
    summary: 'Set a default session with views and tracks',
    run: setDefaultSessionRun,
  },
]

export async function main(args: string[]) {
  try {
    const { values: flags, positionals } = parseArgs({
      args,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        version: {
          type: 'boolean',
          short: 'v',
          default: false,
        },
      },
      allowPositionals: true,
      strict: false, // Allow unknown flags to be passed to subcommands
    })

    // Check if help or version is requested at the global level
    if (flags.help && positionals.length === 0) {
      showGlobalHelp()
      return
    }

    if (flags.version && positionals.length === 0) {
      console.log(`@jbrowse/cli version ${version}`)
      return
    }

    const commandName = positionals[0]
    if (!commandName) {
      console.error('Error: Missing command')
      showGlobalHelp()
      process.exit(1)
    }

    const command = registry.find(c => c.name === commandName)
    if (!command) {
      console.error(`Error: Unknown command "${commandName}"`)
      console.error(
        `Available commands: ${registry.map(c => c.name).join(', ')}`,
      )
      process.exit(1)
    }

    // Pass everything after the command token to the command. Slicing from the
    // command's actual position (rather than a hardcoded index 0) keeps this
    // correct when a global flag precedes the command, e.g. `jbrowse -v create`
    const commandArgs = args.slice(args.indexOf(commandName) + 1)
    await command.run(commandArgs)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code =
      error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined

    console.error('Error:', message)

    if (code === 'EPIPE' || code === 'ENOSPC' || message.includes('EPIPE')) {
      console.error(`
This error may be caused by running out of space in the temporary directory.
Try setting a custom TMPDIR with more available space:

  mkdir mytmpdir
  TMPDIR=mytmpdir jbrowse text-index ...

`)
    }
    process.exit(1)
  }
}

function showGlobalHelp() {
  const width = Math.max(...registry.map(c => c.name.length)) + 2
  const commandLines = registry
    .map(c => `  ${c.name.padEnd(width)}${c.summary}`)
    .join('\n')
  console.log(`
JBrowse CLI

USAGE
  $ jbrowse <command> [options]

COMMANDS
${commandLines}

OPTIONS
  -h, --help     Show help
  -v, --version  Show version

Use "jbrowse <command> --help" for more information about a command.
`)
}
