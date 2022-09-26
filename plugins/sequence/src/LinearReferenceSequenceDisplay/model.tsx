import React from 'react'
import { types } from 'mobx-state-tree'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { Alert, Button } from '@mui/material'
import ZoomInIcon from '@mui/icons-material/ZoomIn'

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
        height: 180,
      }),
    )
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          const { showForward, showReverse, showTranslation } = self
          return {
            ...superRenderProps(),
            rpcDriverName: self.rpcDriverName,
            config: self.configuration.renderer,
            showForward,
            showReverse,
            showTranslation,
          }
        },
        regionCannotBeRendered(/* region */) {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (view && view.bpPerPx > 1) {
            return (
              <Alert
                severity="info"
                action={
                  <Button
                    data-testid="zoom_in_button"
                    onClick={() => view.zoomTo(1)}
                    startIcon={<ZoomInIcon />}
                  >
                    Zoom in
                  </Button>
                }
              >
                Zoom in to see sequence
              </Alert>
            )
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
            label: 'Show translation',
            type: 'checkbox',
            checked: self.showTranslation,
            onClick: () => {
              self.toggleShowTranslation()
            },
          },
        ]
      },
    }))
}
