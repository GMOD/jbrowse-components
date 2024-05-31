import React from 'react'
import { observer } from 'mobx-react'
import copy from 'copy-to-clipboard'

// locals
import { getSession } from '../../../util'
import CascadingMenuButton from '../../../ui/CascadingMenuButton'

// icons
import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'
import { SequenceFeatureDetailsModel } from '../model'
import SequenceFeatureSettingsDialog from './SettingsDialog'
import { MenuItem } from '../../../ui'
import { saveAs } from 'file-saver'

const SequenceFeatureMenu = observer(
  React.forwardRef<
    HTMLDivElement,
    { model: SequenceFeatureDetailsModel; extraItems?: MenuItem[] }
  >(function ({ model, extraItems = [] }, ref) {
    if (typeof ref === 'function') {
      throw new Error('needs a non function ref')
    }
    const { showCoordinates } = model
    return (
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

          {
            label: 'Settings',
            icon: Settings,
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                SequenceFeatureSettingsDialog,
                { model, handleClose },
              ])
            },
          },
          ...extraItems,
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>
    )
  }),
)

export default SequenceFeatureMenu
