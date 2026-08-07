// Genotype-string interning for the cell-data RPC payload.
//
// A per-feature sample→genotype map (Record<sampleName, genotype>) repeats the
// same handful of genotype strings ("0|0", "0/1", "./.") across thousands of
// samples, and — worse — repeats every sampleName string *key* once per feature.
// Across F features that's F×S string keys to structured-clone on every refetch.
//
// Interning ships, once per payload, a shared `dict` of distinct genotype
// strings plus a shared `sampleNames` order; each feature then carries a
// Uint32Array of codes aligned to that order (transferable, sample keys sent
// once). Code 0 = no genotype for that sample; otherwise the string is
// dict[code - 1]. Lifecycle is the cellData payload itself — nothing cached.
//
// Uint32 rather than Uint16, which the dict had to be capped at 65535 entries to
// fit. The cap was reachable — the dict counts distinct genotype STRINGS across
// the payload, and at a multiallelic site those grow with the square of the alt
// count (`12|37` and `37|12` are two entries), so a decomposed pangenome callset
// crosses it — and it degraded quietly: past the cap a genotype interned to 0,
// which the cell loops read as "this sample has no call" and now decline to
// paint at all, since the codes are what they color from. Four bytes a cell
// against a silent hole in the render is not a trade worth making, and the array
// is transferred rather than copied.

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
  codes: Uint32Array,
  sampleName: string,
) {
  const idx = sampleIndex.get(sampleName)
  const code = idx === undefined ? 0 : codes[idx]!
  return code === 0 ? undefined : dict[code - 1]
}

export function buildSampleIndex(sampleNames: string[]) {
  const m = new Map<string, number>()
  for (let i = 0; i < sampleNames.length; i++) {
    m.set(sampleNames[i]!, i)
  }
  return m
}
