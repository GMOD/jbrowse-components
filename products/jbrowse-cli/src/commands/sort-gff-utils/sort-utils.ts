import { spawn } from 'child_process'

import tmp from 'tmp'

import type { ChildProcess } from 'child_process'

export interface SortOptions {
  file?: string
}

export function getMinimalEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LC_ALL: 'C',
  }
}

export function createSortCommandForStdin(): string {
  // Create a temporary file to store stdin content, then process it
  // This allows us to read the data twice - once for headers, once for sorting
  const tmpFile = tmp.fileSync({
    prefix: 'jbrowse-sort-gff',
  }).name
  const sortCmd = `sort -t"\`printf '\\t'\`" -k1,1 -k4,4n`

  // Save stdin to temp file, extract headers, sort non-headers, then cleanup
  return `cat > ${tmpFile} && (grep "^#" ${tmpFile}; grep -v "^#" ${tmpFile} | ${sortCmd}) && rm -f ${tmpFile}`
}

export function createSortCommandForFile(file: string): string {
  // When reading from a file, we can read it multiple times directly
  // Need to wrap in parentheses to ensure both grep outputs are combined
  return `(grep "^#" "${file}"; grep -v "^#" "${file}" | sort -t"\`printf '\\t'\`" -k1,1 -k4,4n)`
}

export function spawnSortProcessFromFile(file: string): ChildProcess {
  const command = createSortCommandForFile(file)
  const env = getMinimalEnvironment()

  return spawn('sh', ['-c', command], {
    env,
    stdio: 'inherit',
  })
}

export function spawnSortProcessFromStdin(): ChildProcess {
  const command = createSortCommandForStdin()
  const env = getMinimalEnvironment()

  return spawn('sh', ['-c', command], {
    env,
    stdio: 'inherit',
  })
}

export function spawnSortProcess(options: SortOptions): ChildProcess {
  return options.file
    ? spawnSortProcessFromFile(options.file)
    : spawnSortProcessFromStdin()
}
