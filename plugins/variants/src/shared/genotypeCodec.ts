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

// How many distinct genotype strings one payload's dict can hold. Codes are
// Uint16 and 0 is reserved for "no genotype", so the last usable code is 65535
// and the dict tops out one short of the type's range.
//
// Reachable, if rarely: the dict is distinct genotype STRINGS across the whole
// payload, which for a biallelic panel is a handful but at a multiallelic site
// grows with the square of the alt count (`12|37` and `37|12` are two entries).
// A decomposed pangenome callset with hundreds of alts per site can cross it.
//
// Past the cap a genotype interns to 0 rather than wrapping: `code + 1` at 65536
// silently truncates to 0, and beyond that onto other codes, so an uncapped dict
// decodes the WRONG genotype string in tooltips and buckets the anchored sort by
// it. 0 is the one value every consumer already handles — it means "this sample
// has no genotype at this site", so the cell is simply not hoverable and sorts
// last, which is honest about knowing nothing rather than confidently wrong.
export const MAX_GENOTYPE_DICT_ENTRIES = 65535

export function internGenotype(
  genotype: string,
  dict: string[],
  dictIndex: Map<string, number>,
) {
  let code = dictIndex.get(genotype)
  if (code === undefined) {
    if (dict.length >= MAX_GENOTYPE_DICT_ENTRIES) {
      return 0
    }
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

export function buildSampleIndex(sampleNames: string[]) {
  const m = new Map<string, number>()
  for (let i = 0; i < sampleNames.length; i++) {
    m.set(sampleNames[i]!, i)
  }
  return m
}
