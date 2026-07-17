import { isBlank } from '../util/assemblyConfigUtils.ts'
import { parseTranslTable } from '../util/geneticCodes.ts'
import { openLocation } from '../util/io/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { RefNameAliases } from './refNameMaps.ts'
import type { FileLocation } from '../util/types/index.ts'

/** NCBI's standard genetic code, used by any refName without a mapping */
const STANDARD_GENETIC_CODE_ID = 1

/**
 * NCBI genetic-code (translation table) id for `refName`, taken from the first
 * of `maps` holding an entry for it, else the standard code (1).
 *
 * A map key and `refName` may each independently be a canonical name or an
 * alias of one: a config generated from NCBI keys by the GFF's RefSeq accession
 * while the assembly's canonical name is the UCSC-style one, and callers that
 * pass a feature's own refName rather than the canonical one. Both sides are
 * resolved through `refNameAliases` (loaded from the chromAlias file) so they
 * meet. The maps are per-assembly contig lists, so scanning them is cheap.
 */
export function lookupGeneticCodeId(
  refName: string,
  refNameAliases: RefNameAliases | undefined,
  maps: Record<string, number>[],
) {
  const canonicalize = (name: string) => refNameAliases?.[name] ?? name
  const target = canonicalize(refName)
  return (
    maps
      .map(
        map =>
          map[refName] ??
          Object.entries(map).find(([k]) => canonicalize(k) === target)?.[1],
      )
      .find(id => id !== undefined) ?? STANDARD_GENETIC_CODE_ID
  )
}

// Loads an optional `refName<TAB>geneticCodeId` TSV (# comments allowed) into a
// map; an empty location yields {} so the inline geneticCodes slot is the only
// source. Kept as a plain file read rather than a pluggable adapter because the
// mapping is trivial and format-fixed.
export async function getGeneticCodesFromFile({
  location,
  pluginManager,
}: {
  location: FileLocation | undefined
  pluginManager: PluginManager
}): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  // skip the config slot's default blank location ({ uri: '' }); a real file
  // yields the refName -> geneticCodeId map
  if (location && !isBlank(location)) {
    const text = await openLocation(location, pluginManager).readFile('utf8')
    for (const line of text.split(/\r\n|\r|\n/)) {
      if (line && !line.startsWith('#')) {
        const [refName, codeColumn] = line.split('\t')
        const id = parseTranslTable(codeColumn)
        if (refName && id !== undefined) {
          map[refName] = id
        }
      }
    }
  }
  return map
}
