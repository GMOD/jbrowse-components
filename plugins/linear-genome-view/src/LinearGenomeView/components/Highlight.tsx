import { Highlighter } from '@jbrowse/core/ui/Icons'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import HighlightBand from './HighlightBand.tsx'
import HighlightChip from './HighlightChip.tsx'
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
  const theme = useTheme()
  const coords = model.getHighlightCoords(highlight)
  const bandColor = getHighlightColor(highlight, theme)

  return coords ? (
    <HighlightBand coords={coords} background={bandColor.toRgbString()}>
      <HighlightChip
        icon={Highlighter}
        color={bandColor}
        label={highlight.label}
        labelsVisible={model.labelsVisible}
        tooltip={highlight.label ?? 'Highlighted region'}
        menuItems={[
          {
            label: 'Dismiss highlight',
            icon: CloseIcon,
            onClick: () => {
              model.removeHighlight(highlight)
            },
          },
          {
            label: 'Turn off highlights',
            icon: VisibilityOffIcon,
            onClick: () => {
              model.setHighlightsVisible(false)
            },
          },
          ...model.highlightMenuItems(highlight),
        ]}
      />
    </HighlightBand>
  ) : null
})

export default Highlight
