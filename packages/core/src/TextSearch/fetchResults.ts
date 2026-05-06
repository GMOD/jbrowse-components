import { RefSequenceResult } from './BaseResults.ts'
import { dedupe } from '../util/index.ts'
import { parseLocString } from '../util/locString.ts'

import type BaseResult from './BaseResults.ts'
import type { SearchType } from '../data_adapters/BaseAdapter/types.ts'
import type { AbstractSessionModel } from '../util/index.ts'

export function filterRefNames(
  allRefNames: string[] | undefined,
  queryString: string,
  searchType?: SearchType,
): RefSequenceResult[] {
  const q = queryString.toLowerCase()
  return (
    allRefNames
      ?.filter(ref =>
        searchType === 'exact'
          ? ref.toLowerCase() === q
          : ref.toLowerCase().startsWith(q),
      )
      .slice(0, 10)
      .map(r => new RefSequenceResult({ label: r, refName: r })) ?? []
  )
}

/**
 * Session-aware search that combines refname prefix matches with text-search
 * hits from aggregate indexes configured on tracks. Returned by
 * `RefNameAutocomplete`'s `fetchResults` prop in views that don't already
 * have a view-level scope (LGV keeps its own variant because its scope is
 * the view's open tracks).
 */
export async function fetchResults({
  queryString,
  session,
  assemblyName,
  searchType,
  rankSearchResults = r => r,
}: {
  queryString: string
  session: AbstractSessionModel
  assemblyName: string
  searchType?: SearchType
  rankSearchResults?: (results: BaseResult[]) => BaseResult[]
}) {
  const { textSearchManager, assemblyManager } = session
  const textResults =
    (await textSearchManager?.search(
      { queryString, searchType },
      { assemblyName, includeAggregateIndexes: true },
      rankSearchResults,
    )) ?? []

  const assembly = assemblyManager.get(assemblyName)
  const refNameResults = filterRefNames(
    assembly?.allRefNames,
    queryString,
    searchType,
  )

  return dedupe([...refNameResults, ...textResults], elt => elt.getId())
}

/**
 * Resolves a user-typed location string (refname, refname:start-end, or
 * gene/feature name) to absolute 0-based half-open coordinates.
 *
 * Resolution order:
 * 1. Parse as refname:start-end — returns coords directly.
 * 2. Parse as refname-only — looks up chromosome extent from assembly regions.
 * 3. Text search (gene/feature name) — resolves the first hit's location.
 */
function tryParse(
  str: string,
  isValidRefName: (ref: string) => boolean,
) {
  try {
    return parseLocString(str, isValidRefName)
  } catch {
    return undefined
  }
}

export async function resolveLocString({
  input,
  session,
  assemblyName,
}: {
  input: string
  session: AbstractSessionModel
  assemblyName: string
}): Promise<{ refName: string; start: number; end: number }> {
  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)
  const isValidRefName = (ref: string) =>
    assemblyManager.isValidRefName(ref, assemblyName)

  const parsed = tryParse(input, isValidRefName)
  if (parsed) {
    if (parsed.start !== undefined && parsed.end !== undefined) {
      return { refName: parsed.refName, start: parsed.start, end: parsed.end }
    }
    const chromRegion = assembly?.regions?.find(
      r => r.refName === parsed.refName,
    )
    if (chromRegion) {
      return {
        refName: parsed.refName,
        start: chromRegion.start,
        end: chromRegion.end,
      }
    }
  }

  const results = await fetchResults({
    queryString: input,
    session,
    assemblyName,
    searchType: 'exact',
  })
  const hit = results[0]
  if (!hit) {
    throw new Error(`"${input}" not found in assembly ${assemblyName}`)
  }
  const hitLoc = hit.getLocation() ?? hit.getLabel()
  const hitParsed = tryParse(hitLoc, isValidRefName)
  if (hitParsed?.start !== undefined && hitParsed.end !== undefined) {
    return {
      refName: hitParsed.refName,
      start: hitParsed.start,
      end: hitParsed.end,
    }
  }
  const refName = hitParsed?.refName ?? hitLoc
  const reg = assembly?.regions?.find(r => r.refName === refName)
  if (!reg) {
    throw new Error(
      `"${input}" resolved to "${hitLoc}" but no coordinates found`,
    )
  }
  return { refName, start: reg.start, end: reg.end }
}
