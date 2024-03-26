#!/usr/bin/env node
import yargs from 'yargs'
import { addTrack, addTrackOptions } from './add-track.js'
import { addAssembly, addAssemblyOptions } from './add-assembly.js'

await yargs(process.argv.slice(2))
  .command(
    'add-track <track>',
    'Add a track to a config.json file',
    addTrackOptions(),
    async run => addTrack(run),
  )
  .command(
    'add-assembly <assembly>',
    'Add an assembly to a config.json file',
    addAssemblyOptions(),
    async run => addAssembly(run),
  )
  .strictCommands()
  .demandCommand()
  .help().argv
