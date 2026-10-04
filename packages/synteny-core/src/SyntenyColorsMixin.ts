import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { TrackColorsMixin } from './TrackColorsMixin.ts'
import { colorableColumns } from './attributeChannels.ts'
import { DEFAULT_MIN_ALIGNMENT_LENGTH } from './minLengthHelp.ts'
import {
  DEFAULT_NUMERIC_OPACITY_RANGE,
  opacityFadeOf,
  opacityLevel,
  opacityMapsField,
} from './opacityChannel.ts'
import { syntenyOpacityConfigSchema } from './syntenyOpacityConfigSchema.ts'

import type { ComparativeTrackModel } from './lodTier.ts'
import type {
  SyntenyOpacityConfigModel,
  SyntenyOpacitySnapshot,
} from './syntenyOpacityConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel SyntenyColorsMixin
 *
 * The colour settings every view drawing synteny tracks shares — the linear
 * synteny view, the dotplot and the circular view: `TrackColorsMixin`'s colour
 * object and palette, the `opacity` object and the shortest alignment drawn,
 * over the tracks the view says it draws. A view supplies `syntenyTracks()`,
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
  return types
    .compose(
      'SyntenyColorsMixin',
      TrackColorsMixin({ defaultColorField }),
      types.model({
        /**
         * #property
         * The opacity every alignment draws at, a
         * [](/docs/config/syntenyopacity) object: a number for all of them,
         * or a field each carries read into opacities, `{ field: "identity" }`
         * or a column the tracks declare. Unset, the view's default: low on
         * the synteny view for dense whole-genome hairballs, opaque on the
         * dotplot.
         */
        opacity: types.stripDefault(syntenyOpacityConfigSchema, {}),
        /**
         * #property
         * Hide alignment blocks shorter than this many bp, which cuts
         * whole-genome hairball noise.
         */
        minAlignmentLength: types.stripDefault(
          types.number,
          DEFAULT_MIN_ALIGNMENT_LENGTH,
        ),
      }),
    )
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
      // both ends hands the colour pass the same fade and recolours nothing
      const fade = stableIdentityComputed(() =>
        opacityFadeOf(readOpacity(self.opacity)),
      )
      return {
        /**
         * #getter
         * The constant opacity a reset returns to.
         */
        get defaultOpacity() {
          return defaultOpacity
        },
        /**
         * #getter
         * The `opacity` object as its snapshot holds it.
         */
        get opacitySetting(): SyntenyOpacitySnapshot {
          return readOpacity(self.opacity)
        },
        /**
         * #getter
         * What the colour pass fades each alignment by: the field's mapping with
         * its range as shares of `opacityLevel`, or undefined while `opacity`
         * draws its constant, so the slider recolours nothing either way.
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
         * The field `opacity` fades by, `''` while it draws its constant.
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
         * (the ortholog-table adapter's slot), one colour mode each.
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
         * The key's chips are composited by the plot's opacity, as the
         * alignments are.
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
       * so its most opaque end lands on `value`.
       */
      setOpacity(value: number) {
        const setting = self.opacitySetting
        if (opacityMapsField(setting)) {
          const level = self.opacityLevel
          const range = (setting.range ?? []).map(Number)
          self.opacity = cast({
            ...setting,
            range: (range.length > 0 ? range : DEFAULT_NUMERIC_OPACITY_RANGE)
              .map(n => (level > 0 ? (n * value) / level : value))
              .map(String),
          })
        } else {
          self.opacity = cast({ ...setting, value })
        }
      },
      /**
       * #action
       * Fade by `field` from the current opacity down to 0.3 of it, or with
       * `''` draw every alignment at the opacity the fade reached.
       */
      setOpacityField(field: string) {
        const level = self.opacityLevel
        self.opacity = cast(
          field
            ? {
                field,
                range: DEFAULT_NUMERIC_OPACITY_RANGE.map(n =>
                  String(n * level),
                ),
              }
            : level === defaultOpacity
              ? {}
              : { value: level },
        )
      },
      /**
       * #action
       */
      setMinAlignmentLength(value: number) {
        self.minAlignmentLength = value
      },
    }))
}

function readOpacity(
  opacity: Instance<SyntenyOpacityConfigModel>,
): SyntenyOpacitySnapshot {
  return {
    value: readConfObject(opacity, 'value'),
    field: readConfObject(opacity, 'field'),
    scale: readConfObject(opacity, 'scale'),
    domain: readConfObject(opacity, 'domain'),
    range: readConfObject(opacity, 'range'),
    domainMin: readConfObject(opacity, 'domainMin'),
    domainMax: readConfObject(opacity, 'domainMax'),
  }
}

export interface SyntenyColorsModel extends Instance<
  ReturnType<typeof SyntenyColorsMixin>
> {}

/**
 * #api
 * What a view holding `SyntenyColorsMixin` hands the view it opens on the same
 * alignments: the colour it paints by, which a view on its default scheme
 * leaves to the new view's own, the pinned track colours, the unlabelled
 * filter and the length filter. Opacity stays each view's own default, since a
 * linear ribbon, a dotplot point and a circle's ribbon draw at densities of
 * their own.
 */
export function carriedSyntenySettings(view: SyntenyColorsModel) {
  const { trackColors, hideUnlabelled, minAlignmentLength } = getSnapshot(view)
  const paintsDefault = view.colorField === '' && view.colorValue === undefined
  return {
    ...(paintsDefault ? {} : { color: getSnapshot(view.color) }),
    trackColors,
    hideUnlabelled,
    minAlignmentLength,
  }
}
