#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { version } from './version.ts'

// single source of truth for both dispatch and the global help listing, so a
// new command can never be wired into one but forgotten in the other.
//
// Each command is LOADED WHEN IT IS DISPATCHED, not imported here: a static
// import list makes every invocation pay for every command's module graph, and
// text-index's parsers alone are most of it. `jbrowse add-track` went from
// 0.35s to 0.21s of startup, which is the whole of what that command does.
const registry: {
  name: string
  summary: string
  load: () => Promise<(args: string[]) => Promise<void>>
}[] = [
  {
    name: 'create',
    summary: 'Downloads and installs the latest JBrowse 2 release',
    load: () => import('./commands/create.ts').then(m => m.run),
  },
  {
    name: 'add-assembly',
    summary: 'Add an assembly to a JBrowse 2 configuration',
    load: () => import('./commands/add-assembly/index.ts').then(m => m.run),
  },
  {
    name: 'add-track',
    summary: 'Add a track to a JBrowse 2 configuration',
    load: () => import('./commands/add-track.ts').then(m => m.run),
  },
  {
    name: 'validate',
    summary:
      'Check a configuration for errors, including ones JBrowse accepts silently',
    load: () => import('./commands/validate/index.ts').then(m => m.run),
  },
  {
    name: 'text-index',
    summary: 'Make a text-indexing file for any given track(s)',
    load: () => import('./commands/text-index/index.ts').then(m => m.run),
  },
  {
    name: 'admin-server',
    summary: 'Start up a small admin server for JBrowse configuration',
    load: () => import('./commands/admin-server/index.ts').then(m => m.run),
  },
  {
    name: 'upgrade',
    summary: 'Upgrades JBrowse 2 to latest version',
    load: () => import('./commands/upgrade.ts').then(m => m.run),
  },
  {
    name: 'make-pif',
    summary: 'Creates pairwise indexed PAF (PIF), with bgzip and tabix',
    load: () => import('./commands/make-pif/index.ts').then(m => m.run),
  },
  {
    name: 'make-density',
    summary:
      'Counts feature starts per bin into a bigWig density sidecar, with bedGraphToBigWig',
    load: () => import('./commands/make-density/index.ts').then(m => m.run),
  },
  {
    name: 'sort-gff',
    summary: 'Sort a GFF/GTF for tabix: sort -k1,1 -k4,4n, header kept on top',
    load: () => import('./commands/sort-gff.ts').then(m => m.run),
  },
  {
    name: 'sort-bed',
    summary: 'Sort a BED for tabix: sort -k1,1 -k2,2n, header kept on top',
    load: () => import('./commands/sort-bed.ts').then(m => m.run),
  },
  {
    name: 'add-connection',
    summary: 'Add a connection to a JBrowse 2 configuration',
    load: () => import('./commands/add-connection.ts').then(m => m.run),
  },
  {
    name: 'add-track-json',
    summary: 'Add a track configuration directly from a JSON hunk',
    load: () => import('./commands/add-track-json.ts').then(m => m.run),
  },
  {
    name: 'remove-track',
    summary: 'Remove a track configuration from a JBrowse 2 configuration',
    load: () => import('./commands/remove-track.ts').then(m => m.run),
  },
  {
    name: 'set-default-session',
    summary: 'Set a default session with views and tracks',
    load: () => import('./commands/set-default-session.ts').then(m => m.run),
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
    // ...but that slice drops a help flag written before the command, so
    // `jbrowse --help create` used to run create with no args and fail on the
    // missing positional instead of printing its help
    if (flags.help && !commandArgs.some(a => a === '--help' || a === '-h')) {
      commandArgs.push('--help')
    }
    await (
      await command.load()
    )(commandArgs)
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
