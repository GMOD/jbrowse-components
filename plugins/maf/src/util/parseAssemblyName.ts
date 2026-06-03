export interface ParsedAssemblyName {
  assemblyName: string
  chr: string
}

/**
 * Parses assembly name and chromosome from a combined string in MAF tabix format.
 *
 * Handles multiple formats:
 * - Single string with no dots: assemblyName is the entire string, chr is empty
 * - `assembly.chr`: Single dot separates assembly name from chromosome
 * - `assembly.version.chr`: Two dots where middle part is numeric (version number)
 *   - assemblyName includes the version (e.g., "hg38.1" from "hg38.1.chr1")
 * - `assembly.chr.more`: Two dots where middle part is non-numeric
 *   - assemblyName is first part, chr includes rest (e.g., "mm10" and "chr1.random")
 */
export function parseAssemblyAndChr(
  assemblyAndChr: string,
): ParsedAssemblyName {
  const firstDotIndex = assemblyAndChr.indexOf('.')
  if (firstDotIndex === -1) {
    return {
      assemblyName: assemblyAndChr,
      chr: '',
    }
  }

  const secondDotIndex = assemblyAndChr.indexOf('.', firstDotIndex + 1)
  if (secondDotIndex === -1) {
    return {
      assemblyName: assemblyAndChr.slice(0, firstDotIndex),
      chr: assemblyAndChr.slice(firstDotIndex + 1),
    }
  }

  const secondPart = assemblyAndChr.slice(firstDotIndex + 1, secondDotIndex)
  // A version segment is a plain run of digits; `/^\d+$/` avoids the unary-`+`
  // coercion accepting `0x1f`, `1e3`, `Infinity`, or whitespace-padded numbers.
  const isNumeric = /^\d+$/.test(secondPart)

  if (isNumeric) {
    return {
      assemblyName: assemblyAndChr.slice(0, secondDotIndex),
      chr: assemblyAndChr.slice(secondDotIndex + 1),
    }
  }

  return {
    assemblyName: assemblyAndChr.slice(0, firstDotIndex),
    chr: assemblyAndChr.slice(firstDotIndex + 1),
  }
}

/**
 * Resolve a `genome.sequence` source token against a known sample set by its
 * longest dot-bounded prefix (or the whole token). The genome can itself
 * contain dots (a `.1`/`.2` haplotype, e.g. `Species1.1.chr3`), so a fixed
 * dot-position split is ambiguous — the known set removes the guess.
 * `Species1.1` beats `Species1` when both are present.
 *
 * Returns undefined when no sample matches, so callers skip that token.
 */
export function matchSampleId(
  token: string,
  sampleIds: Set<string>,
): ParsedAssemblyName | undefined {
  if (sampleIds.has(token)) {
    return { assemblyName: token, chr: '' }
  }
  for (
    let dot = token.lastIndexOf('.');
    dot > 0;
    dot = token.lastIndexOf('.', dot - 1)
  ) {
    const candidate = token.slice(0, dot)
    if (sampleIds.has(candidate)) {
      return { assemblyName: candidate, chr: token.slice(dot + 1) }
    }
  }
  return undefined
}

/**
 * Parses assembly name and chromosome from a combined string in BigMaf format.
 *
 * Uses simple dot splitting: org.chr where org is before the first dot,
 * chr is everything after the first dot.
 */
export function parseAssemblyAndChrSimple(
  organismChr: string,
): ParsedAssemblyName {
  const dotIndex = organismChr.indexOf('.')
  if (dotIndex === -1) {
    return {
      assemblyName: organismChr,
      chr: '',
    }
  }
  return {
    assemblyName: organismChr.slice(0, dotIndex),
    chr: organismChr.slice(dotIndex + 1),
  }
}

/**
 * Selects the appropriate sequence from alignments based on the lookup order:
 * 1. refAssemblyName config value (if provided)
 * 2. query.assemblyName (from the region being queried)
 * 3. firstAssemblyNameFound (fallback to first assembly in data)
 */
export function selectReferenceSequenceString(
  alignments: Record<string, { seq: string }>,
  refAssemblyName: string | undefined,
  queryAssemblyName: string | undefined,
  firstAssemblyNameFound: string | undefined,
): string | undefined {
  for (const name of [
    refAssemblyName,
    queryAssemblyName,
    firstAssemblyNameFound,
  ]) {
    if (name && alignments[name]) {
      return alignments[name].seq
    }
  }
  return undefined
}
