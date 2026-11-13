import { lazy } from 'react'

import { ConfigurationReference, setConf } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { getDialogHost, getSession } from '@jbrowse/core/util'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { IDENTITY_SCALE } from '@jbrowse/core/util/colorScale'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import ColorWritesMixin, {
  solidColorOf,
} from '@jbrowse/display-kit/ColorWritesMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { FILE_COLOR } from '../LinearMarkDisplay/markColor.ts'
import { stateModelFactory as markStateModelFactory } from '../LinearMarkDisplay/model.ts'
import { multiRowMenuItems } from './multiRowMenus.ts'

import type { ColorSource } from '../LinearMarkDisplay/markColor.ts'
import type { MarkRegionData } from '../LinearMarkDisplay/markList.ts'
import type { LinearMultiRowFeatureDisplayConfigModel } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AttributeScanOptions } from '@jbrowse/display-kit/AttributeFieldInput'
import type { Instance } from '@jbrowse/mobx-state-tree'

const ColorByAttributeDialog = lazy(
  () => import('@jbrowse/display-kit/ColorByAttributeDialog'),
)
const RowsFieldDialog = lazy(() => import('./components/RowsFieldDialog.tsx'))

// Whether the loaded regions split on `field` say the features in view carry
// it: undefined until a region read for it holds a feature, false where every
// such feature lacks it. The regions are the whole view the render fetch read.
function featuresCarry(regions: Iterable<MarkRegionData>, field: string) {
  let read: boolean | undefined
  for (const region of regions) {
    if (
      region.request?.facet?.field === field &&
      region.layers.some(layer => layer.count > 0)
    ) {
      read = !!read || (region.facet ?? []).some(({ key }) => key !== '')
    }
  }
  return read
}

/**
 * #stateModel LinearMultiRowFeatureDisplay
 * #category display
 * The mark display drawing a `rect` per feature in a row per value of the
 * attribute `rows.field` states, each in its file's own BED color unless
 * something states another, with One row per and Color by pickers over the
 * attributes the features in view carry.
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
    .volatile(() => ({
      /**
       * #volatile
       * Whether One row per has been offered or picked in this session, so a
       * pick of the default itself, which writes nothing, is not asked again.
       */
      rowsFieldAsked: false,
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the loaded regions show the features in view carrying the
       * rows field in force: undefined until one read for it holds a
       * feature, and while no field splits the rows.
       */
      get featuresCarryRowsField(): boolean | undefined {
        return self.drawsRows
          ? featuresCarry(self.featurePayloads.values(), self.rowsField)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * A mark naming no color under a display naming none paints each
       * feature's own BED color, a placeholder black reading as none
       * (ADR-265).
       */
      get unsetColor(): ColorSource {
        return FILE_COLOR
      },
      /**
       * #getter
       * The field the display's color paints by, or undefined for none.
       */
      get colorField(): string | undefined {
        return self.writtenColor.field || undefined
      },
      /**
       * #getter
       * The field Color by's Attribute... picker opens on: the one painting,
       * else the one parked, never strand, which has its own row.
       */
      get colorByAttribute(): string {
        const field = this.colorField ?? self.parkedColor?.field ?? ''
        return field === STRAND_FIELD ? '' : field
      },
      /**
       * #getter
       * The constant every feature paints, undefined for none or a `jexl:`
       * callback.
       */
      get solidColor(): string | undefined {
        return solidColorOf(self.writtenColor)
      },
      /**
       * #getter
       * The Color by row that is ticked: a field, else a constant, else
       * Default, the file's own colors; none for a `jexl:` field, which no
       * row could write back.
       */
      get colorByMode():
        | 'default'
        | 'solid'
        | 'strand'
        | 'attribute'
        | 'custom' {
        const field = this.colorField
        return field === undefined
          ? this.solidColor === undefined
            ? 'default'
            : 'solid'
          : field === STRAND_FIELD
            ? 'strand'
            : isJexl(field)
              ? 'custom'
              : 'attribute'
      },
      /**
       * #getter
       * The chip at the head of the plot while no feature in view carries the
       * rows field in force, so every feature draws in the one row of no
       * value.
       */
      get rowsHint(): { title: string; text: string } | undefined {
        return self.featuresCarryRowsField === false
          ? {
              title: 'Pick the attribute each row stands for a value of',
              text: 'One row per...',
            }
          : undefined
      },
      /**
       * #method
       * The attributes the features in view carry and the values of each, for
       * the One row per and Color by pickers: the render fetch's download
       * over the visible blocks on the track's genomes, refused where the
       * display's byte budget refuses it.
       */
      scanGroupByCandidates(opts: AttributeScanOptions) {
        const onTrack = onTrackAssembly(self)
        return getSession(self).rpcManager.call(
          getRpcSessionId(self),
          'MarkGetFieldCandidates',
          {
            adapterConfig: self.adapterConfig,
            byteLimit: self.resolvedByteLimit(),
            regions: self.host.staticBlocks.contentBlocks.filter(b =>
              onTrack(b.assemblyName),
            ),
            ...opts,
          },
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * One row per value of `field`, `''` for one row; another field than
       * the one in force drops the arrangement and the colors pinned on the
       * old rows (the keyed rule, ADR-257), and keeps `rows.color`.
       */
      setRowsField(field: string) {
        self.rowsFieldAsked = true
        setConf(self.conf, ['rows', 'field'], field)
      },
      /**
       * #action
       */
      setRowsFieldAsked() {
        self.rowsFieldAsked = true
      },
    }))
    .actions(self => ({
      /**
       * #action
       * One row per's Attribute..., and the hint chip's click.
       */
      openRowsFieldDialog() {
        getDialogHost(self).queueDialog(handleClose => [
          RowsFieldDialog,
          { model: self, handleClose },
        ])
      },
      /**
       * #action
       * The picker the display opens unasked: dismissing it chooses one row,
       * written so the choice outlives the session and no instance asks again.
       */
      askRowsField() {
        getDialogHost(self).queueDialog(handleClose => [
          RowsFieldDialog,
          {
            model: self,
            handleClose,
            onDismiss: () => {
              self.setRowsField('')
            },
          },
        ])
      },
      /**
       * #action
       * Color by's Attribute....
       */
      openColorByAttributeDialog() {
        getDialogHost(self).queueDialog(handleClose => [
          ColorByAttributeDialog,
          { model: self, handleClose },
        ])
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
    .actions(self => ({
      afterAttach() {
        // Where no feature in view carries the rows field in force, `type`
        // by default, ask which attribute the rows stand for, as the mark
        // display opens its plot dialog on an undecided plot; a dismissal
        // writes one row, a pick writes its field, and either ends the asking.
        addDisposer(
          self,
          autorun(() => {
            if (!self.rowsFieldAsked && self.featuresCarryRowsField === false) {
              self.setRowsFieldAsked()
              self.askRowsField()
            }
          }),
        )
      },
    }))
    .actions(self => {
      const { pickDefaultColor: superPickDefaultColor } = self
      return {
        /**
         * #action
         * Color by's Default, the file's own colors: a key stating them, as
         * written or as a pick away from it parked it, stays or comes back;
         * otherwise the display's color is unset.
         */
        pickDefaultColor() {
          const { field, scale } = self.writtenColor
          if (
            self.parkedIdentity ||
            (!field && scale?.type === IDENTITY_SCALE)
          ) {
            self.colorByIdentity()
          } else {
            superPickDefaultColor()
          }
        },
      }
    })
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
