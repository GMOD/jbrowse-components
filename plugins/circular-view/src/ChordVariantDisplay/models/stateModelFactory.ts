import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { getEnv, openFeatureWidget } from '@jbrowse/core/util'
import {
  abgrAlpha,
  cssColorToABGR,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import {
  CATEGORICAL_FIELD_PRESETS,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  derivedColorScale,
  everyRowPaints,
} from '@jbrowse/core/util/legendCandidates'
import {
  colorEncodingOf,
  colorFieldOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import {
  BaseChordDisplay,
  installChordFetch,
} from '../../chords/BaseChordDisplay.ts'
import { getEndpoint } from '../../chords/chordGeometry.ts'
import { hitChord } from '../../chords/chordHit.ts'
import { chordLabel } from '../../chords/chordLabel.ts'
import { axisX, chordEndsAt } from '../../chords/chordStage.ts'
import { DIMMED_OPACITY } from '../../chords/shaders/chordStage.generated.ts'
import { shapePath } from '../../chords/shapePath.ts'

import type { ExportSvgOptions } from '../../CircularView/model.ts'
import type { ChordCell } from '../../chords/chordMarks.ts'
import type { ChordLanes } from '../../chords/chordStage.ts'
import type { ChordShape } from '../../chords/shapes.ts'
import type { ChordVariantDisplayConfigModel } from './configSchema.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
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
    .volatile(() => ({
      /**
       * #volatile
       * ids of the records to keep at full strength while the rest dim;
       * undefined dims nothing. The SV inspector writes the selected record's
       * event here
       */
      highlightedFeatureIds: undefined as string[] | undefined,
      /**
       * #volatile
       * ids of the records to draw; undefined draws them all. The SV
       * inspector writes the rows its sheet's filters leave here, so a filter
       * change is a redraw and no refetch
       */
      visibleFeatureIds: undefined as string[] | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * the held records `visibleFeatureIds` leaves
       */
      get drawnFeatures(): Feature[] | undefined {
        const visible = self.visibleFeatureIds
          ? new Set(self.visibleFeatureIds)
          : undefined
        return visible
          ? self.features?.filter(f => visible.has(f.id()))
          : self.features
      },
      /**
       * #getter
       */
      get highlightedFeatureIdSet() {
        return self.highlightedFeatureIds
          ? new Set(self.highlightedFeatureIds)
          : undefined
      },
    }))
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
       * every held record's two ends on the circle's unrolled axis, by the
       * record's place in `features`: its own start, and its mate's position
       * where it names one, else its own end. `junction` is the two ends
       * unordered, which a breakend pair's two records share.
       */
      get chordFeet() {
        const features = self.features ?? []
        const n = features.length
        const feet = {
          x: new Float32Array(n),
          x2: new Float32Array(n),
          xGaps: new Uint32Array(n),
          x2Gaps: new Uint32Array(n),
          placed: new Uint8Array(n),
          junction: new Array<string>(n),
          index: new Map<Feature, number>(),
        }
        const sliceOf = (refName: string) => self.axisSlice(undefined, refName)
        features.forEach((feature, i) => {
          feet.index.set(feature, i)
          const start = sliceOf(feature.get('refName'))
          if (!start) {
            return
          }
          const { endBlock, endPosition } = getEndpoint(feature, sliceOf, start)
          if (endBlock) {
            feet.placed[i] = 1
            feet.x[i] = axisX(start, feature.get('start'))
            feet.x2[i] = axisX(endBlock, endPosition)
            feet.xGaps[i] = start.gaps
            feet.x2Gaps[i] = endBlock.gaps
            const own = `${start.index}:${feature.get('start')}`
            const far = `${endBlock.index}:${endPosition}`
            feet.junction[i] = own < far ? `${own}|${far}` : `${far}|${own}`
          }
        })
        return feet
      },
      /**
       * #getter
       * the `color` object as written
       */
      get colorSetting(): ColorSetting {
        return colorSnapshotOf(self.configuration.color)
      },
      /**
       * #getter
       * the field the chords paint by, undefined for a constant or callback
       */
      get colorField() {
        return colorFieldOf(colorEncodingOf(this.colorSetting))
      },
      /**
       * #getter
       * each drawn record's color: its field's value through the scale, or
       * the `value` the color object answers for it
       */
      get chordStrokes(): Map<Feature, string> {
        const features = self.drawnFeatures ?? []
        const field = this.colorField
        if (field) {
          const read = fieldReader(field.field, getEnv(self).pluginManager.jexl)
          return new Map(
            features.map(f => [f, field.color(field.key(read(f)))]),
          )
        }
        const { color } = self.configuration
        return new Map(
          features.map(feature => [
            feature,
            readConfObject(color, 'value', { feature }),
          ]),
        )
      },
      /**
       * #getter
       * the drawn records a chord stands for, one per junction: the first
       * record of a breakend pair draws it, and `laneOfId` sends both records'
       * ids to that lane
       */
      get chordPicks() {
        const feet = this.chordFeet
        const picked: number[] = []
        const features: Feature[] = []
        const laneOfId = new Map<string, number>()
        const laneOfJunction = new Map<string, number>()
        for (const feature of self.drawnFeatures ?? []) {
          const i = feet.index.get(feature)
          if (i === undefined || !feet.placed[i]) {
            continue
          }
          const junction = feet.junction[i]!
          const lane = laneOfJunction.get(junction)
          if (lane === undefined) {
            laneOfJunction.set(junction, picked.length)
            laneOfId.set(feature.id(), picked.length)
            picked.push(i)
            features.push(feature)
          } else {
            laneOfId.set(feature.id(), lane)
          }
        }
        return { picked, features, laneOfId }
      },
      /**
       * #getter
       * the drawn records as the chord mark's lanes, each in its color with
       * the alpha the SV inspector's dimming leaves it
       */
      get chordLanes(): ChordLanes {
        const feet = this.chordFeet
        const strokes = this.chordStrokes
        const highlighted = self.highlightedFeatureIdSet
        const packed = new Map<string, number>()
        const { picked, features } = this.chordPicks
        const n = picked.length
        const lanes: ChordLanes = {
          x: new Float32Array(n),
          x2: new Float32Array(n),
          xGaps: new Uint32Array(n),
          x2Gaps: new Uint32Array(n),
          color: new Uint32Array(n),
          count: n,
          features,
        }
        picked.forEach((i, k) => {
          const feature = features[k]!
          const css = strokes.get(feature)!
          let abgr = packed.get(css)
          if (abgr === undefined) {
            abgr = cssColorToABGR(css)
            packed.set(css, abgr)
          }
          lanes.x[k] = feet.x[i]!
          lanes.x2[k] = feet.x2[i]!
          lanes.xGaps[k] = feet.xGaps[i]!
          lanes.x2Gaps[k] = feet.x2Gaps[i]!
          lanes.color[k] =
            highlighted?.has(feature.id()) === false
              ? withAbgrAlpha(
                  abgr,
                  Math.round(abgrAlpha(abgr) * DIMMED_OPACITY),
                )
              : abgr
        })
        return lanes
      },
      /**
       * #getter
       * how many records the chord lanes hold, the ones whose ends are under a
       * pixel apart included
       */
      get drawnCount() {
        return this.chordLanes.count
      },
      /**
       * #getter
       * each drawn record's place in the lanes, by id
       */
      get laneIndexById() {
        return this.chordPicks.laneOfId
      },
      /**
       * #method
       * lane `i` as the SVG side draws it, on the unrotated figure; undefined
       * for a chord whose ends are under a pixel apart
       */
      shapeAt(i: number): ChordShape | undefined {
        const lanes = this.chordLanes
        const feature = lanes.features[i]!
        const ends = chordEndsAt(lanes, i, self.figureStage)
        return ends
          ? {
              kind: 'chord',
              feature,
              ends,
              stroke: this.chordStrokes.get(feature)!,
            }
          : undefined
      },
      /**
       * #method
       * the chord a drawn record's id names, as the SVG side draws it;
       * undefined for an id the lanes do not hold, and for a chord whose ends
       * are under a pixel apart
       */
      shapeFor(featureId: string) {
        const i = this.laneIndexById.get(featureId)
        return i === undefined ? undefined : this.shapeAt(i)
      },
      /**
       * #getter
       * every drawn chord as the export draws it
       */
      get shapes(): ChordShape[] {
        const out: ChordShape[] = []
        for (let i = 0; i < this.chordLanes.count; i++) {
          const shape = this.shapeAt(i)
          if (shape) {
            out.push(shape)
          }
        }
        return out
      },
      /**
       * #method
       * the record whose chord passes nearest a point CSS px from the circle's
       * centre in the screen frame, within `CHORD_HIT_PX`
       */
      hitAt(dx: number, dy: number) {
        if (self.displayPhase !== 'ready') {
          return undefined
        }
        const lanes = this.chordLanes
        const i = hitChord(lanes, self.chordStage, dx, dy)
        return i === undefined ? undefined : lanes.features[i]
      },
      /**
       * #getter
       * `opacity`, over each chord's color's own alpha
       */
      get shapeAlpha(): number {
        return getConf(self, 'opacity')
      },
      /**
       * #method
       */
      shapeLabel(feature: Feature) {
        return chordLabel(feature)
      },
      /**
       * #method
       * a drawn feature's outline as an SVG path on the unrotated figure, for
       * anything that has to find a chord on screen without a DOM node to find
       */
      shapePathFor(feature: Feature) {
        const shape = this.shapeFor(feature.id())
        return shape
          ? shapePath(shape, self.radiusPx, self.bezierRadius)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * what the view's canvas draws for this display: its lanes while it is
       * ready, nothing while its loading or error ring covers the circle
       */
      get chordCell(): ChordCell | undefined {
        return self.displayPhase === 'ready'
          ? { kind: 'chord', lanes: self.chordLanes, display: self }
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
      /**
       * #action
       */
      setHighlightedFeatureIds(ids: string[] | undefined) {
        self.highlightedFeatureIds = ids
      },
      /**
       * #action
       */
      setVisibleFeatureIds(ids: string[] | undefined) {
        self.visibleFeatureIds = ids
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
        const { value } = self.colorSetting
        return self.colorField || value === undefined || isJexl(value)
          ? undefined
          : value
      },
      /**
       * #getter
       * the key of the values the drawn chords paint, while they paint a field
       */
      get colorScales(): ColorScale[] {
        const field = self.colorField
        if (!field) {
          return []
        }
        const read = fieldReader(field.field, getEnv(self).pluginManager.jexl)
        const painted = new Map<string, number>()
        for (const feature of self.chordLanes.features) {
          const value = field.key(read(feature))
          if (!painted.has(value)) {
            painted.set(value, cssColorToABGR(field.color(value)))
          }
        }
        return derivedColorScale(
          [painted],
          entries =>
            everyRowPaints(
              [...entries].map(([value, color]) => ({ value, color })),
            ),
          {
            id: 'color',
            field,
            title:
              withPreset(self.colorSetting, CATEGORICAL_FIELD_PRESETS).title ??
              field.field,
          },
        )
      },
      /**
       * #getter
       */
      get legendSpec() {
        return legendSpecOf(this.colorScales)
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
