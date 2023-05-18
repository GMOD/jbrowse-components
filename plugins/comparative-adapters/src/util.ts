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
            refName,
            start: +start,
            end: +end,
            score: +score,
            name,
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
