#!/usr/bin/env node
import yargs from 'yargs/yargs'

// const argv = yargs(process.argv.slice(2)).options({
//   a: { type: 'boolean', default: false },
//   b: { type: 'string' },
//   c: { type: 'number', alias: 'chill' },
//   d: { type: 'array' },
//   e: { type: 'count' },
//   f: { choices: ['1', '2', '3'] },
// }).argv

const argv = yargs(process.argv.slice(2))
  .command(
    'add-track',
    'Add a track to a config.json file',
    {
      t: {
        type: 'string',
        alias: 'trackType',
        description: `Type of track, by default inferred from track file`,
      },
      n: {
        type: 'string',
        alias: 'name',
        description:
          'Name of the track. Will be defaulted to the trackId if none specified',
      },
      indexFile: {
        type: 'string',
        description: 'Optional index file for the track',
      },
      d: {
        type: 'string',
        alias: 'description',
        description: 'Optional description of the track',
      },
      a: {
        type: 'string',
        alias: 'assemblyNames',
        description:
          'Assembly name or names for track as comma separated string. If none, will default to the assembly in your config file',
      },
      category: {
        type: 'string',
        description:
          'Optional Comma separated string of categories to group tracks',
      },
      config: {
        type: 'string',
        description: `Any extra config settings to add to a track. i.e '{"defaultRendering": "density"}'`,
      },
      target: {
        type: 'string',
        description: 'path to config file in JB2 installation to write out to.',
      },
      out: {
        type: 'string',
        description: 'synonym for target',
      },
      subDir: {
        type: 'string',
        description:
          'when using --load a file, output to a subdirectory of the target dir',
        default: '',
      },
      trackId: {
        type: 'string',
        description:
          'trackId for the track, by default inferred from filename, must be unique throughout config',
      },
      l: {
        type: 'string',
        alias: 'load',
        description:
          'Required flag when using a local file. Choose how to manage the track. Copy, symlink, or move the track to the JBrowse directory. Or inPlace to leave track alone',
        choices: ['copy', 'symlink', 'move', 'inPlace'],
      },
      skipCheck: {
        type: 'boolean',
        description:
          'Skip check for whether or not the file or URL exists or if you are in a JBrowse directory',
      },
      overwrite: {
        type: 'boolean',
        description: 'Overwrites existing track if it shares the same trackId',
      },
      f: {
        type: 'boolean',
        alias: 'force',
        description: 'Equivalent to `--skipCheck --overwrite`',
      },
      protocol: {
        type: 'string',
        description: 'Force protocol to a specific value',
        default: 'uri',
      },
      bed1: {
        type: 'string',
        description: 'Used only for mcscan anchors/simpleAnchors types',
      },
      bed2: {
        type: 'string',
        description: 'Used only for mcscan anchors/simpleAnchors types',
      },
    },
    test => console.log(test, 'Executing command1'),
  )
  .command('cmd2', 'Command 2', {}, test =>
    console.log(test, 'Executing command2'),
  )
  .strictCommands()
  .demandCommand()
  .help().argv

// yargs.command({
//     command: 'cmd [sub] [key] [value]',
//     describe: 'description goes here',
//     builder: yargs => {
//         yargs.positional(`sub`, {
//             type: `string`,
//             describe: `What this argument is`.
//         })
//          yargs.positional(`key`, {
//             type: `string`,
//             describe: `What this argument is`.
//         })
//         yargs.positional(`value`, {
//             type: `string`,
//             describe: `What this argument is`.
//         })
//     },
//     handler: ({sub, key, value}) => {
//         if (sub) {
//             console.log("something")
//             return
//         }

//         console.log("if not sub, do this")
//     }
// })
