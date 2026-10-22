import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { getEnv, getSession, openFeatureWidget } from '@jbrowse/core/util'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import {
  abgrToCssRgba,
  cssColorToABGR,
  scaleAbgrAlpha,
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
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import {
  colorByMenuItem,
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  colorEncodingOf,
  colorFieldOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { types } from '@jbrowse/mobx-state-tree'

import { axisX } from '../../CircularView/slices.ts'
import {
  BaseChordDisplay,
  installChordFetch,
} from '../../chords/BaseChordDisplay.ts'
import { getEndpoint } from '../../chords/chordGeometry.ts'
import { hitChord } from '../../chords/chordHit.ts'
import { chordLabel } from '../../chords/chordLabel.ts'
import { chordEndsAt } from '../../chords/chordStage.ts'
import { DIMMED_OPACITY } from '../../chords/shaders/chordStage.generated.ts'
import { CHORD_DEFAULT_COLOR } from './chordColorConfigSchema.ts'

import type { ChordCell } from '../../chords/chordMarks.ts'
import type { ChordLanes } from '../../chords/chordStage.ts'
import type { ChordShape } from '../../chords/shapes.ts'
import type { ChordVariantDisplayConfigModel } from './configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #stateModel ChordVariantDisplay
 * Draws the structural variants of a `VariantTrack` in a `CircularView`, each
 * translocation as a chord across the circle.
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
      ColorWritesMixin(),
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
       * record's place in `features`: its start, and its mate's position
       * where it has one, else its end. `junction` is the two ends
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
        const assembly = self.assemblyOf(undefined)
        const sliceOf = (refName: string) => self.axisSlice(undefined, refName)
        // by refName, not slice: an elided slice holds many contigs
        const place = (refName: string, pos: number) =>
          `${assembly === undefined ? refName : self.canonicalRefName(assembly, refName)}:${pos}`
        features.forEach((feature, i) => {
          feet.index.set(feature, i)
          const refName = feature.get('refName')
          const start = sliceOf(refName)
          if (!start) {
            return
          }
          const { endBlock, endRefName, endPosition } = getEndpoint(
            feature,
            sliceOf,
            start,
          )
          if (endBlock) {
            feet.placed[i] = 1
            feet.x[i] = axisX(start, feature.get('start'))
            feet.x2[i] = axisX(endBlock, endPosition)
            feet.xGaps[i] = start.gaps
            feet.x2Gaps[i] = endBlock.gaps
            const own = place(refName, feature.get('start'))
            const far = place(endRefName, endPosition)
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
      get paintedColorField() {
        const encoding = colorEncodingOf(this.colorSetting)
        return colorFieldOf(encoding, heldColorSlots(self, encoding))
      },
      /**
       * #getter
       * each drawn record's color: its field's value through the scale, or
       * the `value` the color object answers for it
       */
      get chordStrokes(): Map<Feature, string> {
        const features = self.drawnFeatures ?? []
        const field = this.paintedColorField
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
              ? scaleAbgrAlpha(abgr, DIMMED_OPACITY)
              : abgr
        })
        return lanes
      },
      /**
       * #getter
       * the chord lanes, the ones whose ends are under a pixel apart included
       */
      get drawnLanes() {
        return this.chordLanes
      },
      /**
       * #getter
       * each drawn record's lane by id, a breakend pair's twin included
       */
      get laneIndexById(): ReadonlyMap<string, number> {
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
       * the chord passing nearest a figure point, within `CHORD_HIT_PX`
       */
      laneAt(x: number, y: number) {
        return hitChord(this.chordLanes, self.figureStage, x, y)
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
        return self.paintedColorField || value === undefined || isJexl(value)
          ? undefined
          : abgrToCssRgba(
              scaleAbgrAlpha(cssColorToABGR(value), self.shapeAlpha),
            )
      },
      /**
       * #getter
       * the key of the values the drawn chords paint, while they paint a field
       */
      get colorScales(): ColorScale[] {
        const field = self.paintedColorField
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
       * #getter
       * the test id on the chord paths' group, on screen and in the export
       */
      get shapesTestId() {
        return 'structuralVariantChordRenderer'
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      async renderSvg() {
        const { renderShapesSvg } =
          await import('../../chords/ShapeDisplay.tsx')
        return renderShapesSvg(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the constant `color.value` holds as written, undefined for none or a
       * `jexl:` one
       */
      get solidColor(): string | undefined {
        const { value } = self.writtenColor
        return typeof value === 'string' && !isJexl(value) ? value : undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       * the picker Color by's Solid color... opens
       */
      openSolidColorDialog() {
        getSession(self).queueDialog(handleClose => [
          SolidColorDialog,
          {
            label: 'Chord color',
            color: self.solidColor ?? CHORD_DEFAULT_COLOR,
            written: self.writtenColor.value,
            onChange: (color: string) => {
              self.setColorValue(color)
            },
            onReset: () => {
              self.setColorValue(undefined)
            },
            handleClose,
          },
        ])
      },
    }))
    .views(self => ({
      /**
       * #method
       * Color by... and Advanced → Edit plot..., which the circular view
       * shows under its Tracks menu
       */
      trackMenuItems(): MenuItem[] {
        const field = self.paintedColorField?.field
        return [
          colorByMenuItem({
            blocks: [
              {
                rows: [
                  {
                    label: 'Default',
                    type: 'radio',
                    checked: !field && self.solidColor === undefined,
                    onClick: () => {
                      self.pickDefaultColor()
                    },
                  },
                  {
                    label: 'SV type',
                    type: 'radio',
                    checked: field === SV_TYPE_FIELD,
                    onClick: () => {
                      self.colorByField(SV_TYPE_FIELD)
                    },
                  },
                  solidColorItem(
                    !field && self.solidColor !== undefined,
                    () => {
                      self.pickSolidColor()
                    },
                  ),
                ],
              },
            ],
          }),
          ...editPlotMenuItems(self),
        ]
      },
    }))
}

export default stateModelFactory
