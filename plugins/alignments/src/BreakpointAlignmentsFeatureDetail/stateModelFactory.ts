import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import { stateModelFactory as alignmentsWidgetModelFactory } from '../AlignmentsFeatureDetail/stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

type ReadSnapshot = Record<string, unknown>

interface PairSnapshot {
  id?: string
  type: 'BreakpointAlignmentsWidget'
  featureData?: {
    feature1?: SimpleFeatureSerialized
    feature2?: SimpleFeatureSerialized
  }
  read1?: ReadSnapshot
  read2?: ReadSnapshot
}

function readSnapshot(read: ReadSnapshot, id: string | undefined) {
  return {
    ...read,
    ...(id === undefined ? {} : { id }),
    type: 'AlignmentsFeatureWidget' as const,
  }
}

/**
 * #stateModel BreakpointAlignmentsWidget
 * The two alignments either side of a breakpoint split view's read curve, each
 * an `AlignmentsFeatureWidget` with its row's view and track, so each persists
 * by that widget's rules. Each read's id derives from the widget's, so the next
 * pair opened into the widget reconciles onto the same two reads. A snapshot
 * whose `featureData` holds `feature1` and `feature2` loads as the two reads.
 */
export function stateModelFactory(pluginManager: PluginManager) {
  const Read = alignmentsWidgetModelFactory(pluginManager)
  return types
    .model('BreakpointAlignmentsWidget', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('BreakpointAlignmentsWidget'),
      /**
       * #property
       */
      read1: types.optional(Read, { type: 'AlignmentsFeatureWidget' }),
      /**
       * #property
       */
      read2: types.optional(Read, { type: 'AlignmentsFeatureWidget' }),
    })
    .preProcessSnapshot((snap: PairSnapshot) => {
      const { featureData, read1, read2, ...rest } = snap
      const { id } = rest
      return {
        ...rest,
        read1: readSnapshot(
          read1 ?? { featureData: featureData?.feature1 },
          id && `${id}-read1`,
        ),
        read2: readSnapshot(
          read2 ?? { featureData: featureData?.feature2 },
          id && `${id}-read2`,
        ),
      }
    })
}

export interface BreakpointAlignmentsWidgetModel extends Instance<
  ReturnType<typeof stateModelFactory>
> {}
