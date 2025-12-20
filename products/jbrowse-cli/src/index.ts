#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

// Command imports
import { run as addAssemblyRun } from './commands/add-assembly'
import { run as addConnectionRun } from './commands/add-connection'
import { run as addTrackRun } from './commands/add-track'
import { run as addTrackJsonRun } from './commands/add-track-json'
import { run as adminServerRun } from './commands/admin-server'
import { run as createRun } from './commands/create'
import { run as makePIFRun } from './commands/make-pif'
import { run as removeTrackRun } from './commands/remove-track'
import { run as setDefaultSessionRun } from './commands/set-default-session'
import { run as sortBedRun } from './commands/sort-bed'
import { run as sortGffRun } from './commands/sort-gff'
import { run as textIndexRun } from './commands/text-index'
import { run as upgradeRun } from './commands/upgrade'

const commands = {
  create: createRun,
  'add-assembly': addAssemblyRun,
  'add-track': addTrackRun,
  'text-index': textIndexRun,
  'admin-server': adminServerRun,
  upgrade: upgradeRun,
  'make-pif': makePIFRun,
  'sort-gff': sortGffRun,
  'sort-bed': sortBedRun,
  'add-connection': addConnectionRun,
  'add-track-json': addTrackJsonRun,
  'remove-track': removeTrackRun,
  'set-default-session': setDefaultSessionRun,
}

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
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
      )
      console.log(`@jbrowse/cli version ${packageJson.version}`)
      return
    }

    const commandName = positionals[0]
    if (!commandName) {
      console.error('Error: Missing command')
      showGlobalHelp()
      process.exit(1)
    }

    const command = commands[commandName as keyof typeof commands]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!command) {
      console.error(`Error: Unknown command "${commandName}"`)
      console.error(`Available commands: ${Object.keys(commands).join(', ')}`)
      process.exit(1)
    }

    // Pass the remaining arguments to the command
    const commandArgs = args.slice(1) // Remove the command name from args
    await command(commandArgs)
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
  console.log(`
JBrowse CLI

USAGE
  $ jbrowse <command> [options]

COMMANDS
  create               Downloads and installs the latest JBrowse 2 release
  add-assembly         Add an assembly to a JBrowse 2 configuration
  add-track            Add a track to a JBrowse 2 configuration
  text-index           Make a text-indexing file for any given track(s)
  admin-server         Start up a small admin server for JBrowse configuration
  upgrade              Upgrades JBrowse 2 to latest version
  make-pif             Creates pairwise indexed PAF (PIF), with bgzip and tabix
  sort-gff             Helper utility to sort GFF files for tabix
  sort-bed             Helper utility to sort BED files for tabix
  add-connection       Add a connection to a JBrowse 2 configuration
  add-track-json       Add a track configuration directly from a JSON hunk
  remove-track         Remove a track configuration from a JBrowse 2 configuration
  set-default-session  Set a default session with views and tracks

OPTIONS
  -h, --help     Show help
  -v, --version  Show version

Use "jbrowse <command> --help" for more information about a command.
`)
}
