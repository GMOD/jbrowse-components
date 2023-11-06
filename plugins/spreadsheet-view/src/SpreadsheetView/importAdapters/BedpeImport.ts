import { parseStrand } from './util'
import type { Buffer } from 'buffer'

export function parseBedPEBuffer(buffer: Buffer) {
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

  const columns = [
    'refName',
    'start',
    'end',
    'mate.refName',
    'mate.start',
    'mate.end',
    'name',
    'score',
    'strand',
    'mate.strand',
    ...names.slice(9),
  ]
  const rows = []
  for (let j = 0; i < lines.length; i++, j++) {
    const line = lines[i]!
    const l = line.split('\t')
    const ref1 = l[0]!
    const start1 = +l[1]!
    const end1 = +l[2]!
    const ref2 = l[3]!
    const start2 = +l[4]!
    const end2 = +l[5]!
    const name = l[6]!
    const score = +l[7]!
    const strand1 = parseStrand(l[8])
    const strand2 = parseStrand(l[9])

    const rest = Object.fromEntries(
      columns.map((e, idx) => {
        const key = columns[idx] || `extra_${idx}`
        return [key, e]
      }),
    )

    rows.push({
      ...rest,
      id: `row_${i}`,
      start: start1,
      end: end1,
      refName: ref1,
      strand: strand1,
      name,
      score,
      'mate.refName': ref2,
      'mate.start': start2,
      'mate.end': end2,
      'mate.strand': strand2,
    })
  }

  return { header, rows, columns: [...columns] }
}
