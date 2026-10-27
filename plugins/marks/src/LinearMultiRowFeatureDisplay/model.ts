import { ConfigurationReference, setConf } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { getSession } from '@jbrowse/core/util'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { rowsForField } from '@jbrowse/display-kit/rowsConfigSchema'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { stateModelFactory as markStateModelFactory } from '../LinearMarkDisplay/model.ts'
import { multiRowMenuItems } from './multiRowMenus.ts'
import { multiRowPlot } from './multiRowPlot.ts'

import type { DefaultPlot } from '../LinearMarkDisplay/plotDefault.ts'
import type { PlotFields } from '../LinearMarkDisplay/scanPlotFields.ts'
import type { LinearMultiRowFeatureDisplayConfigModel } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearMultiRowFeatureDisplay
 * #category display
 * The mark display drawing a row per value of a feature attribute, with the
 * menus a painting is read through: One row per..., Group by and Color by.
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: LinearMultiRowFeatureDisplayConfigModel,
) {
  return types
    .compose(
      'LinearMultiRowFeatureDisplay',
      markStateModelFactory(pluginManager, configSchema),
      ColorWritesMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMultiRowFeatureDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #method
       * A rect per feature in a row per value of an attribute, as
       * `multiRowPlot` reads the scanned fields.
       */
      defaultPlotOf(fields: PlotFields): DefaultPlot {
        return multiRowPlot(fields)
      },
      /**
       * #getter
       * The attributes the scanned features carry, which the menus offer.
       */
      get attributes(): readonly string[] {
        return self.plotFields?.attributes ?? []
      },
      /**
       * #getter
       */
      get menusOfferPlotFields() {
        return true
      },
      /**
       * #getter
       * The field the display's color paints by, or undefined for none.
       */
      get colorField(): string | undefined {
        const { field } = self.writtenColor
        return typeof field === 'string' && field !== '' ? field : undefined
      },
      /**
       * #getter
       * The constant every feature paints, undefined for none or a `jexl:`
       * callback.
       */
      get solidColor(): string | undefined {
        const { value } = self.writtenColor
        return typeof value === 'string' && !isJexl(value) ? value : undefined
      },
      /**
       * #getter
       * The Color by row that is ticked: a field, else each feature's own BED
       * color through a fieldless identity color, else a constant, else the
       * marks' own colors.
       */
      get colorByMode():
        | 'default'
        | 'solid'
        | 'strand'
        | 'itemRgb'
        | 'attribute' {
        const { scale, value } = self.writtenColor
        const field = this.colorField
        return field === undefined
          ? scale?.type === 'identity' && value === undefined
            ? 'itemRgb'
            : this.solidColor === undefined
              ? 'default'
              : 'solid'
          : field === STRAND_FIELD
            ? 'strand'
            : 'attribute'
      },
    }))
    .actions(self => ({
      /**
       * #action
       * One row per value of `field`; another field than the one in force
       * drops the arrangement (`rowsForField`).
       */
      setRowsField(field: string) {
        const current =
          getSnapshot<Record<string, unknown> | undefined>(self.conf.rows) ?? {}
        const next = rowsForField(current, field)
        if (next !== current) {
          setConf(self.conf, 'rows', next)
        }
      },
      /**
       * #action
       * Color by's itemRgb: each feature its file's color, through a
       * fieldless identity `encoding.color`, so a black triple paints black.
       */
      colorByItemRgb() {
        if (self.colorByMode !== 'itemRgb') {
          setConf(self, ['encoding', 'color'], { scale: { type: 'identity' } })
        }
      },
      /**
       * #action
       * The picker Color by's Solid color... opens.
       */
      openSolidColorDialog() {
        getSession(self).queueDialog(handleClose => [
          SolidColorDialog,
          {
            label: 'Feature color',
            color: self.solidColor ?? featureDefaultColor,
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
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          return [...superTrackMenuItems(), ...multiRowMenuItems(self)]
        },
      }
    })
}

export type LinearMultiRowFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export interface LinearMultiRowFeatureDisplayModel extends Instance<LinearMultiRowFeatureDisplayStateModel> {}
