import { lazy } from 'react'
import { types } from 'mobx-state-tree'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import {
  getSession,
  getContainingView,
  defaultCodonTable,
} from '@jbrowse/core/util'
const SetCodonTableDlg = lazy(() => import('./SetCodonTableDialog'))

export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearReferenceSequenceDisplay'),
        configuration: ConfigurationReference(configSchema),
        showForward: types.optional(types.boolean, true),
        showReverse: types.optional(types.boolean, true),
        showTranslation: types.optional(types.boolean, true),
        showAltStarts: types.optional(types.boolean, false),
        codonTable: types.optional(types.string, defaultCodonTable),
        height: 180,
      }),
    )
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          const {
            codonTable,
            showForward,
            showReverse,
            showAltStarts,
            showTranslation,
          } = self
          return {
            ...superRenderProps(),
            rpcDriverName: self.rpcDriverName,
            config: self.configuration.renderer,
            showForward,
            showReverse,
            showAltStarts,
            showTranslation,
            codonTable,
          }
        },
        regionCannotBeRendered(/* region */) {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (view && view.bpPerPx >= 1) {
            return 'Zoom in to see sequence'
          }
          return undefined
        },

        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }
    })
    .actions(self => ({
      toggleShowForward() {
        self.showForward = !self.showForward
      },
      toggleShowReverse() {
        self.showReverse = !self.showReverse
      },
      toggleShowTranslation() {
        self.showTranslation = !self.showTranslation
      },
      toggleShowAltStarts() {
        self.showAltStarts = !self.showAltStarts
      },
      setCodonTable(arg: string) {
        self.codonTable = arg
      },
    }))
    .views(self => ({
      trackMenuItems() {
        return [
          {
            label: 'Show forward',
            type: 'checkbox',
            checked: self.showForward,
            onClick: () => {
              self.toggleShowForward()
            },
          },
          {
            label: 'Show reverse',
            type: 'checkbox',
            checked: self.showReverse,
            onClick: () => {
              self.toggleShowReverse()
            },
          },
          {
            label: 'Show alternative start codons',
            type: 'checkbox',
            checked: self.showAltStarts,
            onClick: () => {
              self.toggleShowAltStarts()
            },
          },
          {
            label: 'Show translation',
            type: 'checkbox',
            checked: self.showTranslation,
            onClick: () => {
              self.toggleShowTranslation()
            },
          },
          {
            label: 'Set codon table',
            onClick: () => {
              getSession(self).queueDialog(doneCallback => [
                SetCodonTableDlg,
                {
                  codonTable: self.codonTable,
                  handleClose: (arg?: { codonTable: string }) => {
                    if (arg) {
                      self.setCodonTable(arg.codonTable)
                    }
                    doneCallback()
                  },
                },
              ])
            },
          },
        ]
      },
    }))
}
