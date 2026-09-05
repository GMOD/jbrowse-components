import { types } from '@jbrowse/mobx-state-tree'

import type { Sample } from '../types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface HoverHighlight {
  refName: string
  start: number
  end: number
  assemblyName: string
}

/**
 * #stateModel MafSequenceWidget
 * Widget showing multiple-alignment (MAF) sequence for a set of samples over the
 * connected view's regions, with per-row hover highlight state.
 */
export function stateModelFactory() {
  return types
    .model('MafSequenceWidget', {
      id: types.identifier,
      type: types.literal('MafSequenceWidget'),
      // The MAF adapter's config as a SNAPSHOT — `openSubsequenceWidget` reads
      // the display's own `adapterConfig`, which is one. It used to be typed as
      // the config model, which has getters and a slot API this never has.
      adapterConfig: types.frozen<Record<string, unknown> | undefined>(
        undefined,
      ),
      // The launching display's byte budget, captured at open. The widget's
      // read is the alignment file over the widget's span, so the worker
      // measures it against this before it downloads; undefined is the gate
      // declining to act (force-load, or an ungated display) and measures
      // nothing.
      byteLimit: types.frozen<number | undefined>(undefined),
      samples: types.frozen<Sample[] | undefined>(undefined),
      regions: types.frozen<
        | {
            refName: string
            start: number
            end: number
            assemblyName: string
          }[]
        | undefined
      >(undefined),
      connectedViewId: types.maybe(types.string),
    })
    .volatile(() => ({
      hoverHighlight: undefined as HoverHighlight | undefined,
    }))
    .actions(self => ({
      setHoverHighlight(highlight: HoverHighlight | undefined) {
        self.hoverHighlight = highlight
      },
    }))
}

export type MafSequenceWidgetStateModel = ReturnType<typeof stateModelFactory>
export type MafSequenceWidgetModel = Instance<MafSequenceWidgetStateModel>
