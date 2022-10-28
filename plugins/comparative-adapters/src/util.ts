import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { GenericFilehandle } from 'generic-filehandle'
import { unzip } from '@gmod/bgzf-filehandle'

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
