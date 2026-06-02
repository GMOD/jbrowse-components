import { lazy, useState } from 'react'
import type { RefObject } from 'react'

import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'
import { observer } from 'mobx-react'

import CascadingMenuButton from '../../../ui/CascadingMenuButton.tsx'
import { showGenomicCoordsOption } from '../featureTypeUtil.ts'
import { saveAs } from '../../../util/index.ts'

import type { MenuItem } from '../../../ui/index.ts'
import type { SequenceDisplayMode, SequenceFeatureDetailsModel } from '../model.ts'

// lazies
const SequenceFeatureSettingsDialog = lazy(() => import('./SettingsDialog.tsx'))

interface Props {
  model: SequenceFeatureDetailsModel
  ref: RefObject<HTMLDivElement | null>
  mode: SequenceDisplayMode
  extraItems?: MenuItem[]
}
const SequenceFeatureMenu = observer(function SequenceFeatureMenu({
  model,
  ref,
  mode,
  extraItems = [],
}: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const { showCoordinatesSetting } = model

  return (
    <>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Copy plaintext',
            onClick: async () => {
              const { default: copy } = await import('copy-to-clipboard')
              const r = ref.current
              if (r) {
                await copy(r.textContent || '', { format: 'text/plain' })
              }
            },
          },
          {
            label: 'Copy HTML',
            onClick: async () => {
              const { default: copy } = await import('copy-to-clipboard')
              const r = ref.current
              if (r) {
                await copy(r.outerHTML, { format: 'text/html' })
              }
            },
          },
          {
            label: 'Download plaintext',
            onClick: async () => {
              const r = ref.current
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
            onClick: async () => {
              const r = ref.current
              if (r) {
                saveAs(
                  new Blob([r.outerHTML], {
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
              ...(showGenomicCoordsOption(mode)
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
})

export default SequenceFeatureMenu
