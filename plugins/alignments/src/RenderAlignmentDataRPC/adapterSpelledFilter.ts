import {
  REF_NAME_FIELDS,
  withRefNameSpellings,
} from '../shared/alignmentsFilter.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenameRegionsArgs } from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

interface SpellingAssembly {
  getCanonicalRefName2: (refName: string) => string
  getRefNameMapForAdapter: (
    adapterConf: Record<string, unknown>,
    options: BaseOptions,
  ) => Promise<Record<string, string>>
}

export interface SpellingAssemblies {
  requireAssembly: (assemblyName: string) => Promise<SpellingAssembly>
}

/**
 * A read RPC's args with each reference name the filter lists
 * (`REF_NAME_FIELDS`) also in the adapter's spelling, resolved where the
 * regions are renamed, since the worker has no aliases: the name resolves
 * through the assembly's aliases, then the adapter's refName map.
 */
export async function adapterSpelledFilter<
  T extends RenameRegionsArgs & { filter?: readonly FieldPredicate[] },
>(assemblies: SpellingAssemblies | undefined, args: T): Promise<T> {
  const { filter = [], regions, adapterConfig } = args
  const assemblyName = regions?.[0]?.assemblyName
  const assembly =
    assemblies && assemblyName && filter.some(p => REF_NAME_FIELDS.has(p.field))
      ? await assemblies.requireAssembly(assemblyName)
      : undefined
  const names = await assembly?.getRefNameMapForAdapter(adapterConfig, args)
  return assembly && names
    ? {
        ...args,
        filter: withRefNameSpellings(
          filter,
          refName => names[assembly.getCanonicalRefName2(refName)] ?? refName,
        ),
      }
    : args
}
