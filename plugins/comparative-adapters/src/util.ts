import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'

import type { PAFRecord } from './PAFAdapter/util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GenericFilehandle } from 'generic-filehandle2'

export function parseBed(text: string) {
  return new Map(
    text
      .split(/\n|\r\n|\r/)
      .filter(f => !!f || f.startsWith('#'))
      .map(line => {
        const [refName, start, end, name, score, strand] = line.split('\t')
        return [
          name,
          {
            refName,
            start: +start!,
            end: +end!,
            score: +score!,
            name,
            strand: strand === '-' ? -1 : 1,
          },
        ]
      }),
  )
}

export async function readFile(file: GenericFilehandle, opts?: BaseOptions) {
  return fetchAndMaybeUnzipText(file, opts)
}

export function zip(a: number[], b: number[]) {
  return a.map((e, i) => [e, b[i]] as [number, number])
}

export function parseLineByLine<T>(
  buffer: Uint8Array,
  cb: (line: string) => T | undefined,
  opts?: BaseOptions,
): T[] {
  const { statusCallback = () => {} } = opts || {}
  let blockStart = 0
  const entries: T[] = []
  const decoder = new TextDecoder('utf8')

  let i = 0
  while (blockStart < buffer.length) {
    const n = buffer.indexOf(10, blockStart)
    if (n === -1) {
      break
    }
    const b = buffer.subarray(blockStart, n)
    const line = decoder.decode(b).trim()
    if (line) {
      const entry = cb(line)
      if (entry) {
        entries.push(entry)
      }
    }
    if (i++ % 10_000 === 0) {
      statusCallback(
        `Loading ${Math.floor(blockStart / 1_000_000).toLocaleString('en-US')}/${Math.floor(buffer.length / 1_000_000).toLocaleString('en-US')} MB`,
      )
    }
    blockStart = n + 1
  }
  return entries
}

export function parsePAFLine(line: string) {
  const parts = line.split('\t')
  const extraFields = parts.slice(12)
  const extra: Record<string, string | number> = {
    numMatches: +parts[9]!,
    blockLen: +parts[10]!,
    mappingQual: +parts[11]!,
  }

  // Process extra fields only if they exist
  if (extraFields.length) {
    for (const field of extraFields) {
      const colonIndex = field.indexOf(':')
      extra[field.slice(0, colonIndex)] = field.slice(colonIndex + 3)
    }
  }

  return {
    tname: parts[5],
    tstart: +parts[7]!,
    tend: +parts[8]!,
    qname: parts[0],
    qstart: +parts[2]!,
    qend: +parts[3]!,
    strand: parts[4] === '-' ? -1 : 1,
    extra,
  } as PAFRecord
}

export function flipCigar(cigar: string[]) {
  const arr = []
  for (let i = cigar.length - 2; i >= 0; i -= 2) {
    arr.push(cigar[i])
    const op = cigar[i + 1]
    if (op === 'D') {
      arr.push('I')
    } else if (op === 'I') {
      arr.push('D')
    } else {
      arr.push(op)
    }
  }
  return arr
}

export function swapIndelCigar(cigar: string) {
  return cigar.replaceAll('D', 'K').replaceAll('I', 'D').replaceAll('K', 'I')
}
