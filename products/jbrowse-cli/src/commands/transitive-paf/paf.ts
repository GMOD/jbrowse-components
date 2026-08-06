import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

import { csToCigar, pafIdentity } from '@jbrowse/cigar-utils'

/**
 * A PAF row with the columns this command reasons about pulled out, and every
 * other optional tag kept verbatim in `tags` so a pass-through row is byte-clean.
 */
export interface PafRow {
  qname: string
  qlen: number
  qstart: number
  qend: number
  strand: '+' | '-'
  tname: string
  tlen: number
  tstart: number
  tend: number
  numMatches: number
  blockLen: number
  mappingQual: number
  // always a cg-style CIGAR: a cs is folded into one on parse, the same way
  // make-pif does, since a composition has to walk ops and cs would need
  // reverse-complementing to reorient
  cigar: string
  // resolved once here off the row's own tags (de:f:, then odgi's id:f:, then
  // num_matches/block_len), so a composition multiplies the same number the
  // adapters read
  identity: number
  tags: string[]
}

/** The PanSN sample a sequence belongs to: `grape#1#chr1` -> `grape`. */
export function panSNSample(name: string) {
  const i = name.indexOf('#')
  return i === -1 ? name : name.slice(0, i)
}

/**
 * Parse a PAF line. Returns undefined for anything without the 12 mandatory
 * columns (blank, comment, truncated) and for a row with no CIGAR — a row whose
 * alignment is not spelled out cannot be composed through, since there is no way
 * to know which bases of the pivot it pairs with.
 */
export function parsePafRow(line: string): PafRow | undefined {
  if (line.startsWith('#')) {
    return undefined
  }
  const p = line.split('\t')
  if (p.length < 12) {
    return undefined
  }
  const tags = p.slice(12)
  let cigar: string | undefined
  const kept: string[] = []
  for (const tag of tags) {
    if (tag.startsWith('cg:Z:')) {
      cigar ??= tag.slice(5)
    } else if (tag.startsWith('cs:Z:')) {
      // cs wins where both are present: it spells out =/X, so it is strictly
      // more informative than minimap2's M-style cg
      cigar = csToCigar(tag.slice(5))
    } else {
      kept.push(tag)
    }
  }
  if (cigar === undefined) {
    return undefined
  }
  const numMatches = +p[9]!
  const blockLen = +p[10]!
  return {
    qname: p[0]!,
    qlen: +p[1]!,
    qstart: +p[2]!,
    qend: +p[3]!,
    strand: p[4] === '-' ? '-' : '+',
    tname: p[5]!,
    tlen: +p[6]!,
    tstart: +p[7]!,
    tend: +p[8]!,
    numMatches,
    blockLen,
    mappingQual: +p[11]!,
    cigar,
    identity: pafIdentity({
      de: kept.find(t => t.startsWith('de:f:'))?.slice(5),
      id: kept.find(t => t.startsWith('id:f:'))?.slice(5),
      numMatches,
      blockLen,
    }),
    tags: kept,
  }
}

export function formatPafRow(r: PafRow) {
  return `${[
    r.qname,
    r.qlen,
    r.qstart,
    r.qend,
    r.strand,
    r.tname,
    r.tlen,
    r.tstart,
    r.tend,
    r.numMatches,
    r.blockLen,
    r.mappingQual,
    ...r.tags,
    `cg:Z:${r.cigar}`,
  ].join('\t')}\n`
}

/**
 * Stream a PAF (optionally gzipped) a line at a time. Two passes are run over
 * the file — a census of which sample pairs exist, then a load of only the rows
 * the composition needs — which is why this takes a path rather than a stream:
 * stdin cannot be re-read, and buffering a whole pangenome PAF to avoid the
 * second pass is exactly the memory this command is trying not to spend.
 */
export async function forEachPafRow(
  filename: string,
  callback: (row: PafRow) => Promise<void> | void,
) {
  const source = createReadStream(filename)
  const input = /\.b?gz$/i.test(filename) ? source.pipe(createGunzip()) : source
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    const row = parsePafRow(line)
    if (row !== undefined) {
      // awaited so a callback that writes can apply backpressure: the
      // pass-through leg of this command copies the whole input to the output
      await callback(row)
    }
  }
}
