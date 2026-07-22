import { lazy, useState } from 'react'

import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'
import { observer } from 'mobx-react'

import CascadingMenuButton from '../../../ui/CascadingMenuButton.tsx'
import { saveAs } from '../../../util/index.ts'
import {
  modeSupportsRevcomp,
  resolveShowCoordinates,
  showGenomicCoordsOption,
} from '../featureTypeUtil.ts'
import { getSequencePlaintext } from '../util.ts'

import type { MenuItem } from '../../../ui/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'
import type { RefObject } from 'react'

// lazies
const SequenceFeatureSettingsDialog = lazy(() => import('./SettingsDialog.tsx'))

interface Props {
  model: SequenceFeatureDetailsModel
  ref: RefObject<HTMLDivElement | null>
  mode: SequenceDisplayMode
  revcomp: boolean
  setRevcomp: (arg: boolean) => void
  extraItems?: MenuItem[]
}
const SequenceFeatureMenu = observer(function SequenceFeatureMenu({
  model,
  ref,
  mode,
  revcomp,
  setRevcomp,
  extraItems = [],
}: Props) {
  const [showSettings, setShowSettings] = useState(false)
  // the radio reflects what the panel renders, not the raw stored setting: a
  // sticky 'genomic' preference renders as relative in modes that can't label
  // genomic positions, and would otherwise leave every radio unchecked
  const coordinatesMode = resolveShowCoordinates(
    model.showCoordinatesSetting,
    mode,
  )

  return (
    <>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Copy plaintext',
            onClick: async () => {
              const { default: copy } =
                await import('../../../util/copyToClipboard.ts')
              const r = ref.current
              if (r) {
                copy(getSequencePlaintext(r), { format: 'text/plain' })
              }
            },
          },
          {
            label: 'Copy HTML',
            onClick: async () => {
              const { default: copy } =
                await import('../../../util/copyToClipboard.ts')
              const r = ref.current
              if (r) {
                copy(r.outerHTML, { format: 'text/html' })
              }
            },
          },
          {
            label: 'Download plaintext',
            onClick: async () => {
              const r = ref.current
              if (r) {
                saveAs(
                  new Blob([getSequencePlaintext(r)], {
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

          ...(modeSupportsRevcomp(mode)
            ? [
                {
                  label: 'Reverse complement',
                  type: 'checkbox' as const,
                  checked: revcomp,
                  onClick: () => {
                    setRevcomp(!revcomp)
                  },
                },
              ]
            : []),

          {
            label: 'Show coordinates?',
            type: 'subMenu',
            subMenu: [
              {
                label: 'No coordinates',
                type: 'radio',
                checked: coordinatesMode === 'none',
                onClick: () => {
                  model.setShowCoordinates('none')
                },
              },
              {
                label: 'Coordinates relative to feature start',
                type: 'radio',
                checked: coordinatesMode === 'relative',
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
                      checked: coordinatesMode === 'genomic',
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
