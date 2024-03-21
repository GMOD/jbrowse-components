import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { GenericFilehandle } from 'generic-filehandle'
import { unzip } from '@gmod/bgzf-filehandle'
import { PAFRecord } from './PAFAdapter/util'

export function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

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
            end: +end,
            name,
            refName,
            score: +score,
            start: +start,
            strand: strand === '-' ? -1 : 1,
          },
        ]
      }),
  )
}

export async function readFile(file: GenericFilehandle, opts?: BaseOptions) {
  const buffer = (await file.readFile(opts)) as Buffer
  return new TextDecoder('utf8', { fatal: true }).decode(
    isGzip(buffer) ? await unzip(buffer) : buffer,
  )
}

export function zip(a: number[], b: number[]) {
  return a.map((e, i) => [e, b[i]] as [number, number])
}

const decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined

export function parseLineByLine(
  buffer: Buffer,
  cb: (line: string) => PAFRecord,
) {
  let blockStart = 0
  const entries = []
  while (blockStart < buffer.length) {
    const n = buffer.indexOf('\n', blockStart)
    if (n === -1) {
      break
    }
    const b = buffer.slice(blockStart, n)
    const line = (decoder?.decode(b) || b.toString()).trim()
    if (line) {
      entries.push(cb(line))
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
    extra: {
      blockLen: +blockLen,
      mappingQual: +mappingQual,
      numMatches: +numMatches,
      ...rest,
    },
    qend: +qend,
    qname,
    qstart: +qstart,
    strand: strand === '-' ? -1 : 1,
    tend: +tend,
    tname,
    tstart: +tstart,
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
