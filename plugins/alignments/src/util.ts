import { randomColor } from '@jbrowse/core/util/color'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { modificationData } from './shared/modificationData.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AugmentedRegion } from '@jbrowse/core/util'

export async function fetchSequence(
  region: AugmentedRegion,
  adapter: BaseFeatureDataAdapter,
) {
  const { start, end, originalRefName, refName } = region

  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        ...region,
        refName: originalRefName || refName,
        end,
        start,
      })
      .pipe(toArray()),
  )
  return feats[0]?.get('seq') as string | undefined
}

// The IGV-derived table covers the ~14 modifications with conventional colors;
// anything else — a ChEBI id, a rare code — takes core's hash color.
//
// That fallback used to be a local `randomColor` summing char codes into
// `hsl(sum * 10, 20%, 50%)`, which reaches **36 of 360 hues**, every one of them
// at the same fixed 20% saturation: the whole unnamed-modification palette was
// three dozen washed-out near-greys, beside named mods drawn in full-strength
// red and magenta. Core's is djb2-hashed into oklch with an independently mixed
// lightness/chroma tier, and its own tests pin that distinct strings separate
// and that nothing lands on grey.
export function getColorForModification(str: string) {
  return modificationData[str]?.color ?? randomColor(str)
}

export { getTagAlt } from '@jbrowse/modifications-utils'
export { modificationData } from './shared/modificationData.ts'
