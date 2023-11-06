import { assembleLocString } from '@jbrowse/core/util'
import { parseStrand } from './util'
import LocString from './components/LocString'
import type { Buffer } from 'buffer'

export function parseBedBuffer(buffer: Buffer) {
  const data = new TextDecoder('utf8', { fatal: true }).decode(buffer)
  const lines = data.split(/\n|\r\n|\r/).filter(f => !!f)
  const headerLines = []
  let i = 0
  for (
    ;
    i < lines.length &&
    (lines[i]!.startsWith('#') ||
      lines[i]!.startsWith('browser') ||
      lines[i]!.startsWith('track'));
    i++
  ) {
    headerLines.push(lines[i])
  }
  const header = headerLines.join('\n')
  const lastHeaderLine = headerLines.at(-1)
  let names = [] as string[]
  if (lastHeaderLine?.startsWith('#')) {
    names = lastHeaderLine
      .slice(1)
      .split('\t')
      .map(f => f.trim())
  }

  const columns = names.length
    ? ['refName', 'start', 'end', ...names.slice(3)]
    : [
        'refName',
        'start',
        'end',
        'name',
        'score',
        'strand',
        'thickStart',
        'thickEnd',
        'itemRgb',
        'blockCount',
        'blockSizes',
        'blockStarts',
      ]
  const rows = []
  for (let j = 0; i < lines.length; i++, j++) {
    const line = lines[i]!
    const l = line.split('\t')

    const rest = Object.fromEntries(columns.map((e, idx) => [e, l[idx]]))
    const refName = rest.refName!
    const start = +rest.start!
    const end = +rest.end!
    const strand = parseStrand(rest.strand)

    rows.push({
      ...rest,
      loc: assembleLocString({
        refName,
        start,
        end,
      }),
      id: `row_${i}`,
      start,
      end,
      refName,
      strand,
    })
  }

  return {
    header,
    rows,
    columns,
    customComponents: {
      loc: LocString,
    },
  }
}
