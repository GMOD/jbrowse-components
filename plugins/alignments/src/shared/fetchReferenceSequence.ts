import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

// Fetches reference sequence over [regionStart, regionEnd], extending up to
// one region-width on either side so reads spilling across block boundaries
// still get reference bases for mismatch coloring.
//
// Plus a fixed 2bp on each edge, which is what a splice dinucleotide sitting ON
// a boundary needs: a junction's donor starts at the region's last base and its
// acceptor ends at the first, and the read carrying it extends the window only
// when its far end lands within one region-width (the loop below skips a read
// that overshoots rather than clamping it, so a long intron extends nothing).
// The collapsed-intron layout is where that bites — the region IS a padded exon,
// so at a `windowSize` under 2 the two ends fall outside their own regions and
// no window in the view holds either one.
const SPLICE_SITE_MARGIN = 2

export async function fetchReferenceSequence({
  pluginManager,
  sessionId,
  sequenceAdapter,
  region,
  featuresArray,
}: {
  pluginManager: PluginManager
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  region: {
    assemblyName: string
    refName: string
    originalRefName?: string
    start: number
    end: number
  }
  featuresArray: Feature[]
}) {
  const { start: regionStart, end: regionEnd } = region
  let seqFetchStart = regionStart
  let seqFetchEnd = regionEnd
  const maxExtension = regionEnd - regionStart
  for (const f of featuresArray) {
    const s = f.get('start')
    const e = f.get('end')
    if (s < seqFetchStart && s >= regionStart - maxExtension) {
      seqFetchStart = s
    }
    if (e > seqFetchEnd && e <= regionEnd + maxExtension) {
      seqFetchEnd = e
    }
  }
  const seqAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig: sequenceAdapter,
  })
  const fetchStart = Math.max(0, seqFetchStart - SPLICE_SITE_MARGIN)
  const seqFeats = await firstValueFrom(
    seqAdapter
      .getFeatures({
        ...region,
        refName: region.originalRefName || region.refName,
        start: fetchStart,
        end: seqFetchEnd + SPLICE_SITE_MARGIN,
      })
      .pipe(toArray()),
  )
  return {
    regionSequence: seqFeats[0]?.get('seq') as string | undefined,
    regionSequenceStart: fetchStart,
  }
}
