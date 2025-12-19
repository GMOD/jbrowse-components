import { spawn } from 'child_process'

import tmp from 'tmp'

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
    'Helper utility to sort GFF files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep',
  examples: [
    '# sort gff and pipe to bgzip',
    '$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz',
    '$ tabix sorted.gff.gz',
    '',
    '# sort gff from stdin',
    '$ cat input.gff | jbrowse sort-gff | bgzip > sorted.gff.gz',
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

function createSortCommandForStdin(sortColumn: number): string {
  const tmpFile = tmp.fileSync({ prefix: 'jbrowse-sort' }).name
  const sortCmd = `sort -t"\`printf '\\t'\`" -k1,1 -k${sortColumn},${sortColumn}n`
  return `cat > ${tmpFile} && (grep "^#" ${tmpFile}; grep -v "^#" ${tmpFile} | ${sortCmd}) && rm -f ${tmpFile}`
}

function createSortCommandForFile(file: string, sortColumn: number): string {
  return `(grep "^#" "${file}"; grep -v "^#" "${file}" | sort -t"\`printf '\\t'\`" -k1,1 -k${sortColumn},${sortColumn}n)`
}

export function spawnSortProcess(
  file: string | undefined,
  sortColumn: number,
): ChildProcess {
  const command = file
    ? createSortCommandForFile(file, sortColumn)
    : createSortCommandForStdin(sortColumn)

  return spawn('sh', ['-c', command], {
    env: getMinimalEnvironment(),
    stdio: 'inherit',
  })
}
