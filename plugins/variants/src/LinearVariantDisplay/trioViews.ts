import { triosOf } from '../shared/trios.ts'

import type { Trio } from '../shared/trios.ts'
import type { Source } from '../shared/types.ts'

/**
 * The trios a variant display takes its Mendelian check over, which the
 * display and the tables' hosts install alike.
 */
export function variantTrioViews(self: {
  adapterSamples: Source[] | undefined
}) {
  return {
    /**
     * #getter
     * The trios among the adapter's samples, which the worker takes each
     * site's Mendelian check over: every sample whose pedigree `father` or
     * `mother` is a sample too, whether or not its row draws.
     */
    get trios(): Trio[] {
      return triosOf(self.adapterSamples ?? [])
    },
  }
}
