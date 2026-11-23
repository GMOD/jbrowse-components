import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createReadStream } from 'node:fs'
import { parseArgs } from 'node:util'

import { printHelp } from '../../utils.ts'
import { describeExit, waitForProcessClose } from '../process-utils.ts'
import { validateFileArgument, validateRequiredCommands } from './validators.ts'

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

const NEWLINE = Buffer.from('\n')
const HASH = 0x23

// Lines as bytes, not decoded text, so a line leaves exactly as it came in (a
// CRLF file keeps its CR) and a file that is not UTF-8 is not rewritten. One
// batch per input chunk keeps the per-line cost to a subarray.
async function* lineBatches(input: AsyncIterable<Buffer | string>) {
  let tail = Buffer.alloc(0)
  for await (const chunk of input) {
    const data = Buffer.concat([tail, Buffer.from(chunk)])
    const lines = []
    let start = 0
    for (
      let end = data.indexOf(NEWLINE);
      end !== -1;
      end = data.indexOf(NEWLINE, start)
    ) {
      lines.push(data.subarray(start, end))
      start = end + 1
    }
    tail = data.subarray(start)
    yield lines
  }
  if (tail.length > 0) {
    yield [tail]
  }
}

const isBlank = (line: Buffer) =>
  line.every(b => b === 0x20 || (b >= 0x09 && b <= 0x0d))

const withNewlines = (lines: Buffer[]) =>
  Buffer.concat(lines.flatMap(line => [line, NEWLINE]))

// One pass over the input: `#` lines go straight to stdout, in input order,
// and every other non-blank line goes to sort, whose output follows once its
// input ends. Nothing is copied to disk, so there is no temp file for an
// interrupted run to leave behind.
async function sortInput(
  input: AsyncIterable<Buffer | string>,
  { sortColumn, endOfData }: SortConfig,
) {
  const sort = spawn(
    'sort',
    ['-t', '\t', '-k1,1', `-k${sortColumn},${sortColumn}n`],
    {
      env: { ...process.env, LC_ALL: 'C' },
      stdio: ['pipe', 'pipe', 'inherit'],
    },
  )
  const closed = waitForProcessClose(sort)
  const state = { sortStopped: false, consumerGone: false }
  const stopFeeding = () => {
    state.sortStopped = true
  }
  const stopOutput = () => {
    state.consumerGone = true
    sort.kill()
  }
  sort.stdin.on('error', stopFeeding)
  process.stdout.on('error', stopOutput)
  sort.stdout.pipe(process.stdout)

  const endMarker = endOfData ? Buffer.from(endOfData) : undefined
  let dataEnded = false
  for await (const lines of lineBatches(input)) {
    if (state.sortStopped || state.consumerGone) {
      break
    }
    const headers = []
    const data = []
    for (const line of lines) {
      dataEnded =
        dataEnded ||
        (endMarker !== undefined &&
          line.subarray(0, endMarker.length).equals(endMarker))
      if (!dataEnded) {
        if (line[0] === HASH) {
          headers.push(line)
        } else if (!isBlank(line)) {
          data.push(line)
        }
      }
    }
    if (headers.length > 0) {
      process.stdout.write(withNewlines(headers))
    }
    if (data.length > 0 && !sort.stdin.write(withNewlines(data))) {
      await Promise.race([
        once(sort.stdin, 'drain'),
        closed.then(stopFeeding),
      ]).catch(stopFeeding)
    }
  }
  sort.stdin.end()
  const exit = await closed
  await new Promise(resolve => process.stdout.write('', resolve))
  process.stdout.off('error', stopOutput)
  return { exit, consumerGone: state.consumerGone }
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
  validateRequiredCommands(['sort'])

  const input = file ? createReadStream(file) : process.stdin
  const { exit, consumerGone } = await sortInput(input, config)
  input.destroy()

  // These commands exist to be piped (`jbrowse sort-bed in.bed | bgzip > …`), so
  // a consumer that stops reading early — `| head`, `| grep -q` — must not be
  // reported as a sort failure. It used to exit 1 with "exited with code 141".
  if (!consumerGone && exit.code !== 0) {
    throw new Error(`Sort process exited with ${describeExit(exit)}`)
  }
}
