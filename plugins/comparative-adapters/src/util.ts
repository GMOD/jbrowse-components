import { fetchAndMaybeUnzip } from '@jbrowse/core/util'

import type { PAFRecord } from './PAFAdapter/util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Buffer } from 'buffer'
import type { GenericFilehandle } from 'generic-filehandle'

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
  const buf = await fetchAndMaybeUnzip(file, opts)
  const decoder = new TextDecoder('utf8')
  return decoder.decode(buf)
}

export function zip(a: number[], b: number[]) {
  return a.map((e, i) => [e, b[i]] as [number, number])
}

export function parseLineByLine<T>(
  buffer: Buffer,
  cb: (line: string) => T | undefined,
): T[] {
  let blockStart = 0
  const entries: T[] = []
  const decoder = new TextDecoder('utf8')
  while (blockStart < buffer.length) {
    const n = buffer.indexOf('\n', blockStart)
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

    blockStart = n + 1
  }
  return entries
}

export function parsePAFLine(line: string) {
  const [
    qname,
    ,
    qstart,
    qend,
    strand,
    tname,
    ,
    tstart,
    tend,
    numMatches,
    blockLen,
    mappingQual,
    ...fields
  ] = line.split('\t')

  const rest = Object.fromEntries(
    fields.map(field => {
      const r = field.indexOf(':')
      const fieldName = field.slice(0, r)
      const fieldValue = field.slice(r + 3)
      return [fieldName, fieldValue]
    }),
  )

  return {
    tname,
    tstart: +tstart!,
    tend: +tend!,
    qname,
    qstart: +qstart!,
    qend: +qend!,
    strand: strand === '-' ? -1 : 1,
    extra: {
      numMatches: +numMatches!,
      blockLen: +blockLen!,
      mappingQual: +mappingQual!,
      ...rest,
    },
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
