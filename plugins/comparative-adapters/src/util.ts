import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'

import type { BareFeature } from './mcscanUtil.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GenericFilehandle } from 'generic-filehandle2'

// assemblyNames is ordered [query, target]: index 0 is the PAF/delta/chain
// query, index 1 is the target/reference. This is the reverse of the order
// minimap2/nucmer take their inputs. The queryAssembly/targetAssembly config
// fields are an explicit alternative to the positional array. Do not reorder
// without updating PAFAdapter and the synteny docs.
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
  const result = new Map<string, BareFeature>()
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
