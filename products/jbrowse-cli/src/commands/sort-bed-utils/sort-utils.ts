import { spawn, ChildProcess } from 'child_process'

export interface SortOptions {
  file: string
}

export function getMinimalEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LC_ALL: 'C',
  }
}

export function createSortCommandForFile(file: string): string {
  // BED files use columns 1,2 (0-based) for chromosome and start position
  return `(grep "^#" "${file}"; grep -v "^#" "${file}" | sort -t"\`printf '\\t'\`" -k1,1 -k2,2n)`
}

export function spawnSortProcess(options: SortOptions): ChildProcess {
  const command = createSortCommandForFile(options.file)
  const env = getMinimalEnvironment()

  return spawn('sh', ['-c', command], {
    env,
    stdio: 'inherit',
  })
}