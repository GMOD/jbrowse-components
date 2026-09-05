import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import type { BaseMafRpcArgs, MafFrameRecord } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

/**
 * The same three args as the other two tiers, `byteLimit` included. What
 * differs is the value, not the shape: the annotation adapter is a separate
 * frozen config snapshot read off the display config rather than the track's
 * MAF adapter config model, and `getAdapter` accepts a snapshot directly.
 */
export type LinearMafGetAnnotationDataArgs = BaseMafRpcArgs

export interface LinearMafGetAnnotationDataResult {
  records: MafFrameRecord[]
}

/**
 * Fetch the per-species CDS frame rows (UCSC `mafFrames`) overlapping a region
 * from the MAF adapter's `annotationAdapter` sub-adapter (typically a
 * BigBedAdapter over `multiz<N>wayFrames.bb`). Each row carries the reference
 * extent, the species (`src`), the reading `frame`, and the gene `name` — enough
 * for the display to draw a frame-colored CDS box on that species' row. It is a
 * generic feature adapter loaded straight through `getAdapter`, a sibling of the
 * `summaryAdapter` sub-adapter.
 *
 * Gated like the other two tiers, against the frames file itself: one record
 * per CDS exon **per species**, so on a deep alignment the read grows with the
 * span times the species count exactly as the alignment does, and the summary
 * tier carries it out to whole-genome spans. The refusal carries the frames
 * file's own measurement, like every other executor's; the display's banner
 * quotes the tier it measured itself, so nothing else reads this number.
 */
export async function executeMafAnnotationData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'LinearMafGetAnnotationData'>
}): Promise<LinearMafGetAnnotationDataResult | RegionTooLargeResult> {
  // `statusCallback` is this branch's own slot in the fetch's status fan-out —
  // `fetchMafData` hands the annotation branch one — so the frames read reports
  // progress alongside the alignment's instead of leaving the slot empty.
  const {
    regions,
    adapterConfig,
    byteLimit,
    sessionId,
    stopToken,
    statusCallback,
  } = args
  const region = regions[0]!
  const adapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const { tooLarge } = await measureRegionBytes({
    dataAdapter: adapter,
    regions: [region],
    byteLimit,
    stopToken,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  const records: MafFrameRecord[] = []
  await subscribeToObservable(
    adapter.getFeatures(region, { stopToken, statusCallback }),
    f => {
      const src = f.get('src')
      // Only mafFrames-shaped features (those carrying a `src` species column)
      // contribute; a plain reference annotation adapter without `src` is ignored
      // here (it would need a different, reference-row-only path).
      if (typeof src === 'string') {
        // `nextFramePos` alone of the autoSql's four linkage columns — see
        // `MafFrameRecord` for why the other three have no reader. A plain
        // annotation adapter without it yields undefined and the cross-exon
        // stitch no-ops.
        const nextFramePos = f.get('nextFramePos')
        records.push({
          refName: region.refName,
          start: f.get('start'),
          end: f.get('end'),
          src,
          frame: Number(f.get('frame')),
          strand: f.get('strand') ?? 1,
          name: String(f.get('name') ?? ''),
          nextFramePos:
            nextFramePos === undefined ? undefined : Number(nextFramePos),
        })
      }
    },
  )
  return { records }
}
