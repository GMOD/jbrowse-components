import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'

import { fileSync } from 'tmp'

import { printHelp } from '../../utils.ts'
import {
  describeExit,
  diedOfSigpipe,
  waitForProcessClose,
} from '../process-utils.ts'
import { validateFileArgument, validateRequiredCommands } from './validators.ts'

import type { ChildProcess } from 'node:child_process'

export interface SortConfig {
  description: string
  examples: string[]
  sortColumn: number
  fileType: string
  /** a line that ends the data, which it and everything after it leave */
  endOfData?: string
}

export const BED_CONFIG: SortConfig = {
  description:
    'Sort a BED file for tabix. It is `sort -k1,1 -k2,2n` with LC_ALL=C and a tab separator, plus every line starting with # kept at the top rather than sorted into the data, and blank lines dropped, which tabix rejects. Takes a file, or the same data on stdin',
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
    'Sort a GFF or GTF for tabix — the two share a refname/start column layout. It is `sort -k1,1 -k4,4n` with LC_ALL=C and a tab separator, plus every line starting with # kept at the top rather than sorted into the data, and blank lines dropped, which tabix rejects. A `##FASTA` section, which Prokka and Bakta append, is dropped with its pragma: tabix cannot index sequence lines, so load the sequence as the assembly. Takes a file, or the same data on stdin',
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
  endOfData: '##FASTA',
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
// sortColumn, an integer from the BED/GFF configs, and endOfData, a constant
// pragma from the same configs, are interpolated.
export function sortPipeline({ sortColumn, endOfData }: SortConfig): string {
  const input = endOfData ? `sed '/^${endOfData}/,$d' "$1"` : 'cat "$1"'
  return `${input} | grep "^#"; ${input} | grep -v -e "^#" -e "^[[:space:]]*$" | sort -t"\`printf '\\t'\`" -k1,1 -k${sortColumn},${sortColumn}n`
}

function createSortCommandForStdin(config: SortConfig): {
  command: string
  pathArg: string
} {
  // discardDescriptor: we only want the path — the shell below opens the file
  // itself, so tmp's own handle would just be a descriptor left open for the
  // life of the process
  const tmpFile = fileSync({
    prefix: 'jbrowse-sort',
    discardDescriptor: true,
  }).name
  // trap on EXIT removes the temp file whether or not the sort pipeline
  // succeeds (a bare `&& rm` leaks the file when the pipeline fails)
  return {
    command: `trap 'rm -f "$1"' EXIT; cat > "$1" && (${sortPipeline(config)})`,
    pathArg: tmpFile,
  }
}

function createSortCommandForFile(
  file: string,
  config: SortConfig,
): { command: string; pathArg: string } {
  return { command: `(${sortPipeline(config)})`, pathArg: file }
}

export function spawnSortProcess(
  file: string | undefined,
  config: SortConfig,
): ChildProcess {
  const { command, pathArg } = file
    ? createSortCommandForFile(file, config)
    : createSortCommandForStdin(config)

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
  validateRequiredCommands([
    'sh',
    'sort',
    'grep',
    config.endOfData ? 'sed' : 'cat',
  ])

  const child = spawnSortProcess(file, config)
  const exit = await waitForProcessClose(child)

  // These commands exist to be piped (`jbrowse sort-bed in.bed | bgzip > …`), so
  // a consumer that stops reading early — `| head`, `| grep -q` — must not be
  // reported as a sort failure. It used to exit 1 with "exited with code 141".
  if (diedOfSigpipe(exit)) {
    return
  }
  if (exit.code !== 0) {
    throw new Error(`Sort process exited with ${describeExit(exit)}`)
  }
}
