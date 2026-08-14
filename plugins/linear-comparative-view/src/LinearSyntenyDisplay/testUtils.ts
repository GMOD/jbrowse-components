import { makeStringDict } from '@jbrowse/synteny-core'

import type { SyntenyFeatureData } from './model.ts'

/**
 * One alignment block as a test writes it: readable objects, the fields it cares
 * about, defaults for the rest.
 */
export interface FeatureBlock {
  id?: string
  name?: string
  refName?: string
  start: number
  end: number
  strand?: number
  assembly?: string
  mateRefName?: string
  mateStart?: number
  mateEnd?: number
  mateAssembly?: string
}

/**
 * Pack blocks the way the RPC hands them over: parallel typed arrays and
 * dictionary-encoded string lanes, not objects.
 *
 * Shared because four suites had a `data(blocks: Block[])` of their own, each
 * spelling out all fourteen fields of the payload with a slightly different
 * `Block` — so the string lanes going dictionary-encoded was a four-file edit
 * that said nothing about any of the four suites. Mate coordinates default to
 * the feature's own, which is enough for a test exercising one axis.
 */
export function packSyntenyFeatureData(
  blocks: FeatureBlock[],
  { hasCigar = true } = {},
): SyntenyFeatureData {
  const lane = (values: string[]) => {
    const d = makeStringDict()
    return { dict: d.dict, ids: Uint32Array.from(values, v => d.idFor(v)) }
  }
  const names = lane(blocks.map(b => b.name ?? b.id ?? ''))
  const refNames = lane(blocks.map(b => b.refName ?? 'chr1'))
  const assemblies = lane(blocks.map(b => b.assembly ?? 'hg002mat'))
  const mateRefNames = lane(
    blocks.map(b => b.mateRefName ?? b.refName ?? 'chr1'),
  )
  const mateAssemblies = lane(blocks.map(b => b.mateAssembly ?? 'hg002pat'))
  return {
    strands: Int8Array.from(blocks, b => b.strand ?? 1),
    starts: Uint32Array.from(blocks, b => b.start),
    ends: Uint32Array.from(blocks, b => b.end),
    attributes: {},
    attributeRanges: {},
    featureIds: blocks.map((b, i) => b.id ?? `f${i}`),
    nameDict: names.dict,
    nameIds: names.ids,
    refNameDict: refNames.dict,
    refNameIds: refNames.ids,
    assemblyNameDict: assemblies.dict,
    assemblyNameIds: assemblies.ids,
    mateStarts: Uint32Array.from(blocks, b => b.mateStart ?? b.start),
    mateEnds: Uint32Array.from(blocks, b => b.mateEnd ?? b.end),
    mateRefNameDict: mateRefNames.dict,
    mateRefNameIds: mateRefNames.ids,
    mateAssemblyNameDict: mateAssemblies.dict,
    mateAssemblyNameIds: mateAssemblies.ids,
    hasCigar,
  }
}
