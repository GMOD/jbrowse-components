#!/usr/bin/env node

import path from 'path'
import { parseArgs } from 'util'

// Command imports
import AddAssembly from './commands/add-assembly'
import AddConnection from './commands/add-connection'
import AddTrack from './commands/add-track'
import AddTrackJson from './commands/add-track-json'
import AdminServer from './commands/admin-server'
import Create from './commands/create'
import MakePIF from './commands/make-pif'
import RemoveTrack from './commands/remove-track'
import SetDefaultSession from './commands/set-default-session'
import SortBed from './commands/sort-bed'
import SortGff from './commands/sort-gff'
import TextIndex from './commands/text-index'
import Upgrade from './commands/upgrade'

const commands = {
  create: Create,
  'add-assembly': AddAssembly,
  'add-track': AddTrack,
  'text-index': TextIndex,
  'admin-server': AdminServer,
  upgrade: Upgrade,
  'make-pif': MakePIF,
  'sort-gff': SortGff,
  'sort-bed': SortBed,
  'add-connection': AddConnection,
  'add-track-json': AddTrackJson,
  'remove-track': RemoveTrack,
  'set-default-session': SetDefaultSession,
}

async function main(args: string[]) {
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
      const fs = await import('fs')
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

    const CommandClass = commands[commandName as keyof typeof commands]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!CommandClass) {
      console.error(`Error: Unknown command "${commandName}"`)
      console.error(`Available commands: ${Object.keys(commands).join(', ')}`)
      process.exit(1)
    }

    // Pass the remaining arguments to the command
    const commandArgs = args.slice(1) // Remove the command name from args
    
    const command = new CommandClass()
    await command.run(commandArgs)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
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

// Check if this file is being run directly
if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv.slice(2)).catch(console.error)
}

export { main }
