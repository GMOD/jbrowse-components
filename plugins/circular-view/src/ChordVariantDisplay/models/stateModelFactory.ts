import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getEnv, openFeatureWidget } from '@jbrowse/core/util'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { types } from '@jbrowse/mobx-state-tree'

import {
  BaseChordDisplay,
  installChordFetch,
} from '../../chords/BaseChordDisplay.ts'
import { chordLabel } from '../../chords/chordLabel.ts'
import { shapePath } from '../../chords/chordLayer.ts'
import { chordShape } from '../../chords/shapes.ts'

import type { ExportSvgOptions } from '../../CircularView/model.ts'
import type { ChordShape } from '../../chords/shapes.ts'
import type { ChordVariantDisplayConfigModel } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

/**
 * #stateModel ChordVariantDisplay
 *
 * #example
 * The circular-view display for a `VariantTrack` of structural variants;
 * translocations are drawn as chords across the circle. The track config below
 * is what creates it; its colors are the config slots on
 * [](/docs/config/chordvariantdisplay):
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'sv',
 *   name: 'Structural variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/sv.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'ChordVariantDisplay',
 *       displayId: 'sv-ChordVariantDisplay',
 *     },
 *   ],
 * }
 * ```
 */
const stateModelFactory = (configSchema: ChordVariantDisplayConfigModel) => {
  return types
    .compose(
      'ChordVariantDisplay',
      BaseChordDisplay(),
      types.model({
        /**
         * #property
         */
        type: types.literal('ChordVariantDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * the panel the linear variant displays open for the same record
       */
      get featureWidgetType() {
        return { type: 'VariantFeatureWidget', id: 'variantFeature' }
      },
      /**
       * #getter
       * each drawn record's chord, with the colour its config slot answers
       */
      get shapes(): ChordShape[] {
        const { radiusPx, configuration } = self
        const sliceFor = (refName: string) => self.sliceFor(undefined, refName)
        const out: ChordShape[] = []
        for (const feature of self.drawnFeatures ?? []) {
          const shape = chordShape({
            feature,
            sliceFor,
            radius: radiusPx,
            stroke: readConfObject(configuration, 'color', { feature }),
          })
          if (shape) {
            out.push(shape)
          }
        }
        return out
      },
      /**
       * #getter
       * a chord's colour carries its own alpha
       */
      get shapeAlpha() {
        return 1
      },
      /**
       * #method
       */
      shapeLabel(feature: Feature) {
        return chordLabel(feature)
      },
      /**
       * #method
       * a drawn feature's outline as an SVG path, for anything that has to
       * find a chord on screen without a DOM node to find
       */
      shapePathFor(feature: Feature) {
        const shape = this.shapes.find(s => s.feature === feature)
        return shape
          ? shapePath(shape, self.radiusPx, self.bezierRadius)
          : undefined
      },
    }))
    .actions(self => {
      const { pluginManager } = getEnv(self)
      return {
        /**
         * #action
         * the `onChordClick` callback when the config sets one, else the
         * record's details
         */
        onChordClick(feature: Feature) {
          if (isJexl(self.configuration.onChordClick)) {
            getConf(self, 'onChordClick', {
              feature,
              track: self,
              pluginManager,
            })
          } else {
            openFeatureWidget(self, feature.toJSON(), {
              widget: self.featureWidgetType,
              feature,
            })
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * what a click on the canvas reaches
       */
      clickFeature(feature: Feature) {
        self.onChordClick(feature)
      },
    }))
    .actions(self => ({
      afterAttach() {
        installChordFetch(self, {
          name: 'ChordVariantDisplay',
          fetchFeatures: ({ adapterConfig, regions }, ctx) =>
            ctx.callRpc('CoreGetFeatures', { adapterConfig, regions }),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the chord color the circle's key shows, when every chord shares one
       */
      get legendColor(): string | undefined {
        const value: unknown = self.configuration.color
        return typeof value === 'string' && !isJexl(value) ? value : undefined
      },
      /**
       * #method
       */
      async renderSvg(_opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self)
      },
    }))
}

export default stateModelFactory
