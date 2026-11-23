import { mkdir, readdir } from 'node:fs/promises'

import {
  installRelease,
  parseCommand,
  printVersions,
  releaseOptions,
} from '../utils.ts'

const description =
  "Downloads and installs the newest JBrowse 2 release of this CLI's major version"

const examples = [
  '# Download latest release from github, and put in specific path',
  '$ jbrowse create /path/to/new/installation',
  '',
  '# Download latest release from github and force overwrite existing contents at path',
  '$ jbrowse create /path/to/new/installation --force',
  '',
  '# Download latest release from a specific URL',
  '$ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip',
  '',
  '# Download a specific tag from github',
  '$ jbrowse create /path/to/new/installation --tag v1.0.0',
  '',
  '# List available versions',
  '$ jbrowse create --listVersions',
]

const options = {
  ...releaseOptions,
  force: {
    type: 'boolean',
    short: 'f',
    description:
      'Overwrites existing JBrowse 2 installation if present in path',
  },
} as const

export async function run(args: string[]) {
  await parseCommand(args, {
    description,
    examples,
    usage: 'jbrowse create [localPath] [options]',
    options,
    run: async ({ flags, positionals }) => {
      if (flags.listVersions) {
        await printVersions()
      } else {
        const argsPath = positionals[0]
        if (!argsPath) {
          throw new Error(
            'Missing 1 required arg:\nlocalPath  Location where JBrowse 2 will be installed\nSee more help with --help',
          )
        }

        // mkdir will do nothing if dir exists
        await mkdir(argsPath, { recursive: true })

        if (!flags.force) {
          await checkPath(argsPath)
        }

        await installRelease(flags, argsPath)
      }
    },
  })
}

async function checkPath(userPath: string) {
  const allFiles = await readdir(userPath)
  if (allFiles.length > 0) {
    throw new Error(
      `This directory (${userPath}) has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
    )
  }
}
