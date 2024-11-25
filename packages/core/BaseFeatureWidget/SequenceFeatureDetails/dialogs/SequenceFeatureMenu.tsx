import React, { lazy, useState } from 'react'
import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver'
import { observer } from 'mobx-react'

// locals
import CascadingMenuButton from '../../../ui/CascadingMenuButton'
import type { MenuItem } from '../../../ui'
import type { SequenceFeatureDetailsModel } from '../model'

// icons

// lazies
const SequenceFeatureSettingsDialog = lazy(() => import('./SettingsDialog'))

interface Props {
  model: SequenceFeatureDetailsModel
  extraItems?: MenuItem[]
}
const SequenceFeatureMenu = observer(
  React.forwardRef<HTMLDivElement, Props>(function SequenceFeatureMenu2(
    { model, extraItems = [] },
    ref,
  ) {
    if (typeof ref === 'function') {
      throw new Error('needs a non function ref')
    }
    const [showSettings, setShowSettings] = useState(false)
    const { showCoordinatesSetting, showGenomicCoordsOption } = model

    return (
      <>
        <CascadingMenuButton
          menuItems={[
            {
              label: 'Copy plaintext',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  copy(r.textContent || '', { format: 'text/plain' })
                }
              },
            },
            {
              label: 'Copy HTML',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  copy(r.outerHTML, { format: 'text/html' })
                }
              },
            },
            {
              label: 'Download plaintext',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  saveAs(
                    new Blob([r.textContent || ''], {
                      type: 'text/plain;charset=utf-8',
                    }),
                    'sequence.txt',
                  )
                }
              },
            },
            {
              label: 'Download HTML',
              onClick: () => {
                const r = ref?.current
                if (r) {
                  saveAs(
                    new Blob([r.outerHTML || ''], {
                      type: 'text/html;charset=utf-8',
                    }),
                    'sequence.html',
                  )
                }
              },
            },

            ...extraItems,

            {
              label: 'Show coordinates?',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'No coordinates',
                  type: 'radio',
                  checked: showCoordinatesSetting === 'none',
                  onClick: () => {
                    model.setShowCoordinates('none')
                  },
                },
                {
                  label: 'Coordinates relative to feature start',
                  type: 'radio',
                  checked: showCoordinatesSetting === 'relative',
                  onClick: () => {
                    model.setShowCoordinates('relative')
                  },
                },
                ...(showGenomicCoordsOption
                  ? [
                      {
                        label:
                          'Coordinates relative to genome (only available for continuous genome based sequence types)',
                        type: 'radio' as const,
                        checked: showCoordinatesSetting === 'genomic',
                        onClick: () => {
                          model.setShowCoordinates('genomic')
                        },
                      },
                    ]
                  : []),
              ],
            },
            {
              label: 'Settings',
              icon: Settings,
              onClick: () => {
                setShowSettings(true)
              },
            },
          ]}
        >
          <MoreVert />
        </CascadingMenuButton>

        {showSettings ? (
          <SequenceFeatureSettingsDialog
            model={model}
            handleClose={() => {
              setShowSettings(false)
            }}
          />
        ) : null}
      </>
    )
  }),
)

export default SequenceFeatureMenu
