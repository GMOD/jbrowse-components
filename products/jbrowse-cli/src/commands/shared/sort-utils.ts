import { spawn } from 'child_process'
import { parseArgs } from 'util'

import { fileSync } from 'tmp'

import { printHelp } from '../../utils.ts'
import { waitForProcessClose } from '../process-utils.ts'
import { validateFileArgument, validateRequiredCommands } from './validators.ts'

import type { ChildProcess } from 'child_process'

export interface SortConfig {
  description: string
  examples: string[]
  sortColumn: number
  fileType: string
}

export const BED_CONFIG: SortConfig = {
  description:
    'Helper utility to sort BED files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep',
  examples: [
    '# sort bed and pipe to bgzip',
    '$ jbrowse sort-bed input.bed | bgzip > sorted.bed.gz',
    '$ tabix sorted.bed.gz',
    '',
    '# OR pipe data via stdin: cat file.bed | jbrowse sort-bed | bgzip > sorted.bed.gz',
  ],
  sortColumn: 2,
  fileType: 'bed',
}

export const GFF_CONFIG: SortConfig = {
  description:
    'Helper utility to sort GFF (and GTF, which shares the same refname/start column layout) files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep',
  examples: [
    '# sort gff and pipe to bgzip',
    '$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz',
    '$ tabix sorted.gff.gz',
    '',
    '# sort gff from stdin',
    '$ cat input.gff | jbrowse sort-gff | bgzip > sorted.gff.gz',
    '',
    '# also works on GTF',
    '$ jbrowse sort-gff input.gtf | bgzip > sorted.gtf.gz',
    '$ tabix -p gff sorted.gtf.gz',
  ],
  sortColumn: 4,
  fileType: 'gff',
}

function getMinimalEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LC_ALL: 'C',
  }
}

// The file path is passed to the shell as the positional argument "$1" rather
// than interpolated into the command string, so a path containing shell
// metacharacters (`"`, `$(...)`, backticks) cannot break out and execute. Only
// sortColumn, an integer from the BED/GFF configs, is interpolated.
function sortPipeline(sortColumn: number): string {
  return `grep "^#" "$1"; grep -v "^#" "$1" | sort -t"\`printf '\\t'\`" -k1,1 -k${sortColumn},${sortColumn}n`
}

function createSortCommandForStdin(sortColumn: number): {
  command: string
  pathArg: string
} {
  const tmpFile = fileSync({ prefix: 'jbrowse-sort' }).name
  return {
    command: `cat > "$1" && (${sortPipeline(sortColumn)}) && rm -f "$1"`,
    pathArg: tmpFile,
  }
}

function createSortCommandForFile(
  file: string,
  sortColumn: number,
): { command: string; pathArg: string } {
  return { command: `(${sortPipeline(sortColumn)})`, pathArg: file }
}

export function spawnSortProcess(
  file: string | undefined,
  sortColumn: number,
): ChildProcess {
  const { command, pathArg } = file
    ? createSortCommandForFile(file, sortColumn)
    : createSortCommandForStdin(sortColumn)

  // 'sh' becomes $0, pathArg becomes $1 inside the command
  return spawn('sh', ['-c', command, 'sh', pathArg], {
    env: getMinimalEnvironment(),
    stdio: 'inherit',
  })
}

export async function runSort(
  config: SortConfig,
  commandName: string,
  args?: string[],
) {
  const options = { help: { type: 'boolean', short: 'h' } } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  if (flags.help) {
    printHelp({
      description: config.description,
      examples: config.examples,
      usage: `jbrowse ${commandName} [file] [options]`,
      options,
    })
    return
  }

  const file = positionals[0]
  validateFileArgument(file, commandName, config.fileType)
  validateRequiredCommands(['sh', 'sort', 'grep'])

  const child = spawnSortProcess(file, config.sortColumn)
  const exitCode = await waitForProcessClose(child)

  if (exitCode !== 0) {
    throw new Error(`Sort process exited with code ${exitCode}`)
  }
}
