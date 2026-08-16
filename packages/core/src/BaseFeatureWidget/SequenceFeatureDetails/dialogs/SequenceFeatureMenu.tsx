import { lazy, useState } from 'react'

import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'
import { observer } from 'mobx-react'

import CascadingMenuButton from '../../../ui/CascadingMenuButton.tsx'
import { copyText } from '../../../util/copyText.ts'
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
  // every export row reads the rendered panel out of the ref, which is empty
  // until the panel mounts (the sequence is still loading, or errored)
  const withPanel =
    (f: (panel: HTMLDivElement) => Promise<void> | void) => async () => {
      const panel = ref.current
      if (panel) {
        await f(panel)
      }
    }

  return (
    <>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Copy plaintext',
            onClick: withPanel(panel =>
              copyText(model, getSequencePlaintext(panel), 'sequence'),
            ),
          },
          {
            label: 'Copy HTML',
            onClick: withPanel(panel =>
              copyText(model, panel.outerHTML, 'sequence HTML', {
                format: 'text/html',
              }),
            ),
          },
          {
            label: 'Download plaintext',
            onClick: withPanel(panel => {
              saveAs(
                new Blob([getSequencePlaintext(panel)], {
                  type: 'text/plain;charset=utf-8',
                }),
                'sequence.txt',
              )
            }),
          },
          {
            label: 'Download HTML',
            onClick: withPanel(panel => {
              saveAs(
                new Blob([panel.outerHTML], {
                  type: 'text/html;charset=utf-8',
                }),
                'sequence.html',
              )
            }),
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
              {
                label: 'Coordinates relative to genome',
                type: 'radio',
                checked: coordinatesMode === 'genomic',
                disabled: !showGenomicCoordsOption(mode),
                disabledHelpText:
                  'Only available for continuous genome based sequence types',
                onClick: () => {
                  model.setShowCoordinates('genomic')
                },
              },
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
