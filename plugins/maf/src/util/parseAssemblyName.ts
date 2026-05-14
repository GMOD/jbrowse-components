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
  const isNumeric = secondPart.length > 0 && !Number.isNaN(+secondPart)

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
