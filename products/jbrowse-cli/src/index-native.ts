#!/usr/bin/env node

import { parseArgs } from 'util'
import path from 'path'

// Command imports
import CreateNative from './commands/create-native'
import AddAssemblyNative from './commands/add-assembly-native'

const commands = {
  create: CreateNative,
  'add-assembly': AddAssemblyNative,
}

async function main() {
  try {
    const { values: flags, positionals } = parseArgs({
      args: process.argv.slice(2),
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
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
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
    if (!CommandClass) {
      console.error(`Error: Unknown command "${commandName}"`)
      console.error(`Available commands: ${Object.keys(commands).join(', ')}`)
      process.exit(1)
    }

    // Remove the command name from argv before passing to the command
    const originalArgv = process.argv
    process.argv = [process.argv[0], process.argv[1], commandName, ...process.argv.slice(3)]

    const command = new CommandClass()
    await command.run()
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
  create        Downloads and installs the latest JBrowse 2 release
  add-assembly  Add an assembly to a JBrowse 2 configuration
  add-track     Add a track to a JBrowse 2 configuration
  
OPTIONS
  -h, --help     Show help
  -v, --version  Show version

Use "jbrowse <command> --help" for more information about a command.
`)
}

// Check if this file is being run directly
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error)
}

export { main }