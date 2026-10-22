import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'

/**
 * v4's `jexlFilters`, which stored its expressions unprefixed, as `retired`
 * declares it on the base display schema: the `filter` list's expressions now.
 */
export const retiredFilterSpelling = {
  jexlFilters: (list: unknown) => ({
    filter: Array.isArray(list) ? list.map(ensureJexlPrefix) : list,
  }),
}
