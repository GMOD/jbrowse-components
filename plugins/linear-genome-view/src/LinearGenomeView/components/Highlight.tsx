import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { getSession } from '@jbrowse/core/util'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { observer } from 'mobx-react'

import HighlightBand from './HighlightBand.tsx'
import HighlightChip from './HighlightChip.tsx'
import HighlightLabelDialog from './HighlightLabelDialog.tsx'
import { getHighlightColor } from './util.ts'

import type { LinearGenomeViewModel } from '../model.ts'
import type { HighlightType } from '../types.ts'

type LGV = LinearGenomeViewModel

const Highlight = observer(function Highlight({
  model,
  highlight,
}: {
  model: LGV
  highlight: HighlightType
}) {
  const theme = useStyleTheme()
  const coords = model.getHighlightCoords(highlight)
  const bandColor = getHighlightColor(highlight, theme)
  const label = getSession(model).highlightLabelsVisible
    ? highlight.label
    : undefined

  return coords ? (
    <HighlightBand
      coords={coords}
      background={bandColor.toRgbString()}
      label={label}
      gaps={model.nonGenomicTrackBands()}
    >
      <HighlightChip
        color={bandColor}
        label={label}
        tooltip={highlight.label ?? 'Highlighted region'}
        menuItems={[
          {
            label: 'Edit label...',
            icon: EditIcon,
            onClick: () => {
              const session = getSession(model)
              session.queueDialog(handleClose => [
                HighlightLabelDialog,
                {
                  label: highlight.label,
                  onSubmit: (label: string | undefined) => {
                    session.updateHighlight(highlight, { label })
                  },
                  handleClose,
                },
              ])
            },
          },
          {
            label: 'Dismiss highlight',
            icon: CloseIcon,
            onClick: () => {
              getSession(model).removeHighlight(highlight)
            },
          },
          {
            label: 'Turn off highlights',
            icon: VisibilityOffIcon,
            onClick: () => {
              getSession(model).setHighlightsVisible(false)
            },
          },
          ...model.highlightMenuItems(highlight),
        ]}
      />
    </HighlightBand>
  ) : null
})

export default Highlight
