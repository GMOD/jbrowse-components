import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { TrackColorsMixin } from './TrackColorsMixin.ts'
import { colorableColumns } from './attributeChannels.ts'
import {
  DEFAULT_NUMERIC_OPACITY_RANGE,
  opacityFadeOf,
  opacityLevel,
  opacityMapsField,
  opacityRangeAt,
} from './opacityChannel.ts'

import type { ComparativeTrackModel } from './lodTier.ts'
import type {
  SyntenyOpacityConfigModel,
  SyntenyOpacitySnapshot,
} from './syntenyOpacityConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel SyntenyColorsMixin
 *
 * The color settings every view drawing synteny tracks shares — the linear
 * synteny view, the dotplot and the circular view: `TrackColorsMixin`'s
 * `encoding` and palette, the `encoding.opacity` it fades by and the
 * `filter`, over the tracks
 * the view draws. A view supplies `syntenyTracks()`,
 * its opacity default and, optionally, the field it paints by until told
 * otherwise.
 */
export function SyntenyColorsMixin({
  defaultOpacity,
  defaultColorField,
}: {
  defaultOpacity: number
  defaultColorField?: string
}) {
  return TrackColorsMixin({ defaultColorField })
    .named('SyntenyColorsMixin')
    .views(() => ({
      /**
       * #method
       * Overridable hook: every synteny track in the view, in paint order.
       */
      syntenyTracks(): ComparativeTrackModel[] {
        return []
      },
    }))
    .views(self => {
      // structural, so a slider drag that scales a field's range alike at
      // both ends hands the color pass the same fade and recolors nothing
      const fade = stableIdentityComputed(() =>
        opacityFadeOf(readOpacity(self.encoding.opacity)),
      )
      return {
        /**
         * #getter
         * The constant opacity a reset returns to: low on the synteny view
         * for dense whole-genome hairballs, opaque on the dotplot.
         */
        get defaultOpacity() {
          return defaultOpacity
        },
        /**
         * #getter
         * `encoding.opacity` as its snapshot holds it.
         */
        get opacitySetting(): SyntenyOpacitySnapshot {
          return readOpacity(self.encoding.opacity)
        },
        /**
         * #getter
         * What the color pass fades each alignment by: the field's mapping with
         * its range as shares of `opacityLevel`, or undefined while
         * `encoding.opacity` draws its constant, so the slider recolors nothing either way.
         */
        get opacityFade(): SyntenyOpacitySnapshot | undefined {
          return fade.get()
        },
        /**
         * #getter
         * The opacity every alignment draws at before a field's fade: the
         * shader's uniform (`opacityLevel`).
         */
        get opacityLevel() {
          return opacityLevel(
            this.opacitySetting,
            defaultOpacity,
            self.attributeRanges,
          )
        },
        /**
         * #getter
         * The field `encoding.opacity` fades by, `''` while it draws its
         * constant.
         */
        get opacityField() {
          const setting = this.opacitySetting
          return opacityMapsField(setting) ? setting.field! : ''
        },
        /**
         * #method
         */
        colorableTrackConfigs() {
          return self.syntenyTracks().map(t => {
            const { trackId, name } = t.configuration
            return { trackId, name }
          })
        },
        /**
         * #method
         * The columns the tracks declare in their adapter's `attributeColumns`
         * (the ortholog-table adapter's slot), one color mode each.
         */
        colorableAttributeNames() {
          return colorableColumns(
            self.syntenyTracks().flatMap(t => {
              const declared = getConf(t, ['adapter', 'attributeColumns']) as
                | string[]
                | undefined
              return declared ?? []
            }),
          )
        },
        /**
         * #method
         * The plot's opacity composites the key's chips, as it does the
         * alignments.
         */
        legendAlpha() {
          return this.opacityLevel
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * The opacity slider: the constant, or under a field its range scaled
       * so its most opaque end equals `value`.
       */
      setOpacity(value: number) {
        const setting = self.opacitySetting
        self.encoding.setSubschema(
          'opacity',
          opacityMapsField(setting)
            ? {
                ...setting,
                scale: {
                  ...setting.scale,
                  range: opacityRangeAt(setting, value, self.attributeRanges),
                },
              }
            : { ...setting, value },
        )
      },
      /**
       * #action
       * Fade by `field` from the current opacity down to 0.3 of it, or with
       * `''` draw every alignment at the opacity the fade reached.
       */
      setOpacityField(field: string) {
        const level = self.opacityLevel
        self.encoding.setSubschema(
          'opacity',
          field
            ? {
                field,
                scale: {
                  range: DEFAULT_NUMERIC_OPACITY_RANGE.map(n =>
                    String(n * level),
                  ),
                },
              }
            : level === defaultOpacity
              ? {}
              : { value: level },
        )
      },
    }))
}

function readOpacity(
  opacity: Instance<SyntenyOpacityConfigModel>,
): SyntenyOpacitySnapshot {
  const { scale } = opacity
  return {
    value: readConfObject(opacity, 'value'),
    field: readConfObject(opacity, 'field'),
    scale: {
      type: readConfObject(scale, 'type'),
      domain: readConfObject(scale, 'domain'),
      range: readConfObject(scale, 'range'),
      domainMin: readConfObject(scale, 'domainMin'),
      domainMax: readConfObject(scale, 'domainMax'),
    },
  }
}

export interface SyntenyColorsModel extends Instance<
  ReturnType<typeof SyntenyColorsMixin>
> {}

/**
 * #api
 * What a view holding `SyntenyColorsMixin` hands the view it opens on the same
 * alignments: the `encoding.color` it paints by, which a view on its default
 * scheme leaves to the new view's default, the pinned track colors and the
 * `filter`. `encoding.opacity` keeps each view's default, since a linear
 * ribbon, a dotplot point and a circle's ribbon draw at different densities.
 */
export function carriedSyntenySettings(view: SyntenyColorsModel) {
  const { trackColors, filter } = getSnapshot(view)
  const paintsDefault = view.colorField === '' && view.colorValue === undefined
  return {
    ...(paintsDefault
      ? {}
      : { encoding: { color: getSnapshot(view.encoding.color) } }),
    trackColors,
    filter,
  }
}
