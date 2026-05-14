import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GenericFilehandle } from 'generic-filehandle2'

export function parseBed(text: string) {
  return new Map(
    text
      .split(/\n|\r\n|\r/)
      .filter(f => !!f && !f.startsWith('#'))
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

export function parsePAFLine(line: string) {
  const parts = line.split('\t')
  const extra: Record<string, string | number> = {
    numMatches: +parts[9]!,
    blockLen: +parts[10]!,
    mappingQual: +parts[11]!,
  }

  for (let i = 12; i < parts.length; i++) {
    const field = parts[i]!
    const colonIndex = field.indexOf(':')
    extra[field.slice(0, colonIndex)] = field.slice(colonIndex + 3)
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

// Path-name suffix that encodes a subwalk range. odgi uses colon
// (`sample#0#chr20:100864-26386516`); vg uses brackets
// (`sample#chr20[100864-26386516]`).
const RE_PATH_SUBWALK_COLON = /:(-?\d+)-(-?\d+)$/
const RE_PATH_SUBWALK_BRACKET = /\[(-?\d+)-(-?\d+)\]$/

/**
 * Parse a PanSN path name into its genome and refName parts. PanSN is
 * `sample#hap#contig` → genome=`sample#hap`, refName=`contig`. A four-part
 * `sample#hap#contig#fragment` (vg fragmented assemblies) drops the trailing
 * fragment so it still aggregates to `sample#hap`. Two-part `sample#contig`
 * → genome=`sample`. Bare names map genome=refName=name. Subwalk suffixes
 * (`...:start-end` / `...[start-end]`) are stripped and returned separately.
 */
export function parsePanSN(name: string, length = 0) {
  let stripped = name
  let subwalkStart = 0
  let subwalkEnd = length
  const m =
    RE_PATH_SUBWALK_COLON.exec(name) ?? RE_PATH_SUBWALK_BRACKET.exec(name)
  if (m) {
    stripped = name.slice(0, m.index)
    subwalkStart = Number(m[1])
    subwalkEnd = Number(m[2])
  }
  const parts = stripped.split('#')
  if (parts.length >= 3) {
    return {
      genome: `${parts[0]!}#${parts[1]!}`,
      refName: parts[2]!,
      subwalkStart,
      subwalkEnd,
    }
  }
  if (parts.length === 2) {
    return {
      genome: parts[0]!,
      refName: parts[1]!,
      subwalkStart,
      subwalkEnd,
    }
  }
  return { genome: stripped, refName: stripped, subwalkStart, subwalkEnd }
}

export function flipCigar(cigar: string) {
  const ops: [number, string][] = []
  let len = 0
  for (let i = 0, l = cigar.length; i < l; i++) {
    const c = cigar[i]!
    if (c >= '0' && c <= '9') {
      len = len * 10 + (c.charCodeAt(0) - 48)
    } else {
      ops.push([len, c])
      len = 0
    }
  }
  let result = ''
  for (let i = ops.length - 1; i >= 0; i--) {
    const [l, op] = ops[i]!
    result += l
    result += op === 'D' ? 'I' : op === 'I' ? 'D' : op
  }
  return result
}

export function swapIndelCigar(cigar: string) {
  return cigar.replaceAll('D', 'K').replaceAll('I', 'D').replaceAll('K', 'I')
}
