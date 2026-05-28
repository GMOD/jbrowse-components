import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'

import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GenericFilehandle } from 'generic-filehandle2'

export function getAssemblyNamesFromConf(adapter: BaseFeatureDataAdapter) {
  const assemblyNames = adapter.getConf('assemblyNames') as string[]
  if (assemblyNames.length === 0) {
    return [
      adapter.getConf('queryAssembly') as string,
      adapter.getConf('targetAssembly') as string,
    ]
  }
  return assemblyNames
}

export function parseBed(text: string) {
  const result = new Map<
    string,
    {
      refName: string
      start: number
      end: number
      score: number
      name: string
      strand: number
    }
  >()
  for (const line of text.split(/\n|\r\n|\r/)) {
    if (line && !line.startsWith('#')) {
      const [refName, start, end, name, score, strand] = line.split('\t')
      if (refName && start && end && name) {
        result.set(name, {
          refName,
          start: +start,
          end: +end,
          score: +(score ?? 0),
          name,
          strand: strand === '-' ? -1 : 1,
        })
      }
    }
  }
  return result
}

export async function readFile(file: GenericFilehandle, opts?: BaseOptions) {
  return fetchAndMaybeUnzipText(file, opts)
}

// Identity in [0,1] from a parsed PAF row's `extra` map. Prefers the
// `de:f:` tag (minimap2 / make-pif gap-compressed divergence) since it is
// computed from the actual CIGAR — same identity source rustybam's `rb stats
// --paf` writes and SVbyEye computes per-bin. Falls back to odgi untangle's
// `id:f:` tag (a percentage or fraction), then to residue matches over block
// length.
export function pafIdentity(
  extra: Record<string, string | number | undefined>,
) {
  if (extra.de !== undefined) {
    const d = +extra.de
    if (Number.isFinite(d) && d >= 0 && d <= 1) {
      return 1 - d
    }
  }
  if (extra.id !== undefined) {
    const v = +extra.id
    if (Number.isFinite(v)) {
      return v > 1 ? v / 100 : v
    }
  }
  const matches = +(extra.numMatches ?? 0)
  const blockLen = +(extra.blockLen ?? 0)
  return blockLen > 0 ? matches / blockLen : 0
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
