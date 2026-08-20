import { readFileSync } from 'node:fs'

import { parsePAFLine } from './util.ts'

// `parsePAFLine` walks tab offsets. What it has to agree with is the
// split-based parse it replaced, so that parse is written out here and every
// case is checked against it rather than against a hand-copied expectation —
// the offsets are easy to get subtly wrong and impossible to read.
//
// The short-row cases are the reason this file exists. `indexOf` answers -1 at
// the end of a row with fewer than PAF's 12 mandatory columns, and the next call
// then reads `indexOf('\t', -1 + 1)`, which restarts at 0 and hands back offsets
// from the front of the line — so a truncated row parses as a plausible-looking
// record built out of the wrong columns. Removing the monotonic guard that
// catches this left the whole comparative-adapters suite green, because nothing
// else in the repo parses a row that is not well-formed.
function parsePafLineBySplit(line: string) {
  const parts = line.split('\t')
  const extra: Record<string, string | number> = {
    numMatches: +parts[9]!,
    blockLen: +parts[10]!,
    mappingQual: +parts[11]!,
  }
  for (let i = 12; i < parts.length; i++) {
    const field = parts[i]!
    const colonIndex = field.indexOf(':')
    if (colonIndex !== -1) {
      extra[field.slice(0, colonIndex)] = field.slice(colonIndex + 3)
    }
  }
  return {
    tname: parts[5]!,
    tstart: +parts[7]!,
    tend: +parts[8]!,
    qname: parts[0]!,
    qstart: +parts[2]!,
    qend: +parts[3]!,
    strand: parts[4] === '-' ? -1 : 1,
    extra,
  }
}

const cols = (n: number) =>
  Array.from({ length: n }, (_, i) => (i === 4 ? '+' : String(i))).join('\t')

describe('parsePAFLine agrees with the split parse it replaced', () => {
  test.each([
    ['a whole minimap2 PAF', 'test_data/yeast.cigar.paf'],
    ['a PAF with no CIGAR column', 'PAFAdapter/test_data/peach_grape.paf'],
  ])('%s', (_label, path) => {
    const lines = readFileSync(`${__dirname}/${path}`, 'utf8')
      .split('\n')
      .filter(Boolean)
    expect(lines.length).toBeGreaterThan(5)
    for (const line of lines) {
      expect(parsePAFLine(line)).toEqual(parsePafLineBySplit(line))
    }
  })

  test.each([
    ['no tabs at all', 'chr1'],
    ['one column short of mandatory', cols(11)],
    ['half a row', cols(8)],
    ['a single tab', 'chr1\t100'],
    ['empty', ''],
    ['the 12 mandatory columns and nothing else', cols(12)],
    ['a trailing tab after the last mandatory column', `${cols(12)}\t`],
    ['an empty column among the tags', `${cols(12)}\tde:f:0.1\t\tcm:i:8`],
    ['a trailing column that is not a tag at all', `${cols(12)}\tnotatag`],
    // the colon that ends a tag name has to be looked for inside the column: a
    // column with none of its own otherwise finds the next column's and files
    // the pair under a key spanning the tab between them
    ['a non-tag column followed by a tag', `${cols(12)}\tnotatag\tde:f:0.1`],
    ['a tag value holding its own colons', `${cols(12)}\tcs:Z::10*ag:5+ac`],
    ['a minus strand', cols(12).replace('\t+\t', '\t-\t')],
    [
      'a strand column that merely starts with -',
      cols(12).replace('\t+\t', '\t-x\t'),
    ],
  ])('%s', (_label, line) => {
    expect(parsePAFLine(line)).toEqual(parsePafLineBySplit(line))
  })

  // the corpus above is all well-formed, so it cannot show that a short row
  // takes the other path at all — this states the value the wrap-around
  // produced, which is what the guard exists to keep out
  test('a short row does not read columns off the front of the line', () => {
    const short = 'qchr10\t1\t106576099\t106576500\t+\tchr3\t9\t12'
    const parsed = parsePAFLine(short)
    expect(parsed.qstart).toBe(106576099)
    expect(parsed.tend).toBeNaN()
    expect(parsed.extra.numMatches).toBeNaN()
    expect(parsed.extra.blockLen).toBeNaN()
  })
})
