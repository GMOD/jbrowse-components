// Genotype-string interning for the cell-data RPC payload.
//
// A per-feature sample→genotype map (Record<sampleName, genotype>) repeats the
// same handful of genotype strings ("0|0", "0/1", "./.") across thousands of
// samples, and — worse — repeats every sampleName string *key* once per feature.
// Across F features that's F×S string keys to structured-clone on every refetch.
//
// Interning ships, once per payload, a shared `dict` of distinct genotype
// strings plus a shared `sampleNames` order; each feature then carries a
// Uint16Array of codes aligned to that order (transferable, sample keys sent
// once). Code 0 = no genotype for that sample; otherwise the string is
// dict[code - 1]. Lifecycle is the cellData payload itself — nothing cached.

export function internGenotype(
  genotype: string,
  dict: string[],
  dictIndex: Map<string, number>,
) {
  let code = dictIndex.get(genotype)
  if (code === undefined) {
    code = dict.length
    dict.push(genotype)
    dictIndex.set(genotype, code)
  }
  return code + 1
}

export function decodeGenotype(
  dict: string[],
  sampleIndex: Map<string, number>,
  codes: Uint16Array,
  sampleName: string,
) {
  const idx = sampleIndex.get(sampleName)
  const code = idx === undefined ? 0 : codes[idx]!
  return code === 0 ? undefined : dict[code - 1]
}

export function decodeGenotypes(
  dict: string[],
  sampleNames: string[],
  codes: Uint16Array,
) {
  const out: Record<string, string> = {}
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!
    if (code !== 0) {
      out[sampleNames[i]!] = dict[code - 1]!
    }
  }
  return out
}

export function buildSampleIndex(sampleNames: string[]) {
  const m = new Map<string, number>()
  for (let i = 0; i < sampleNames.length; i++) {
    m.set(sampleNames[i]!, i)
  }
  return m
}
