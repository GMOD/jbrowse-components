import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getSession, isFeature, openFeatureWidget } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  GlobalFetchMixin,
  TrackHeightMixin,
  blockKeySignature,
  foundationDisplayStatusPhase,
} from '@jbrowse/plugin-linear-genome-view'

import { groupFeatures, rowAssembliesOf } from './layoutMultiWay.ts'

import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type React from 'react'

/**
 * #stateModel MultiWaySyntenyDisplay
 * #displayFoundation GlobalFetchMixin
 * draws a multi-genome ortholog track (an adapter whose features carry a
 * `mate` per other assembly, e.g. MCScanBlocksAdapter) as one lane per
 * assembly inside a plain linear genome view. The top lane is the view's own
 * assembly at genomic coordinates; every other lane is laid out in its own
 * local coordinate frame fitted to the viewport — non-anchored, the same move
 * the multi-sample variant matrix makes — with ribbons connecting each gene's
 * placements between adjacent lanes. Rendered as main-thread SVG like the arc
 * displays.
 */
export function stateModelFactory(
  configSchema: MultiWaySyntenyDisplayConfigModel,
) {
  return types
    .compose(
      'MultiWaySyntenyDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalFetchMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiWaySyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * lanes to pin to the top, in order; lanes it does not name follow in
         * first-appearance order. A declared property, so it is authorable
         * from a session spec or a config defaultSession
         */
        rowOrder: types.array(types.string),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.features = f
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get canvasWidth() {
        return self.lgv.width
      },
      /**
       * #getter
       * staleness axis is the static-block set, same as arc: pan/zoom past a
       * block boundary refetches, a scroll inside the loaded blocks does not
       */
      get viewSignature() {
        const view = self.lgv
        return view.initialized
          ? blockKeySignature(view.staticBlocks.contentBlocks)
          : undefined
      },
      /**
       * #getter
       */
      get displayPhase(): DisplayStatusPhase {
        return foundationDisplayStatusPhase(self, () => true)
      },
      /**
       * #getter
       */
      get painted(): boolean {
        return self.features !== undefined || !!self.error
      },
    }))
    .views(self => ({
      /**
       * #getter
       * anchor-sorted gene groups reconstructed from the pairwise features
       */
      get groups() {
        return self.features ? groupFeatures(self.features) : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * mate assemblies in first-appearance order, one lane each below the
       * anchor lane
       */
      get rowAssemblies() {
        return rowAssembliesOf(self.groups, [...self.rowOrder])
      },
      /**
       * #getter
       */
      get ribbonColor(): string {
        return getConf(self, 'ribbonColor')
      },
      /**
       * #getter
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON())
      },
      /**
       * #action
       */
      setRowOrder(order: string[]) {
        self.rowOrder.replace(order)
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as MultiWaySyntenyDisplayModel)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
      /**
       * #action
       */
      async renderSvg(
        _opts?: ExportSvgDisplayOptions,
      ): Promise<React.ReactNode> {
        const { renderMultiWaySvg } = await import('./renderSvg.tsx')
        return renderMultiWaySvg(self as MultiWaySyntenyDisplayModel)
      },
    }))
}

export type MultiWaySyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiWaySyntenyDisplayModel =
  Instance<MultiWaySyntenyDisplayStateModel>
