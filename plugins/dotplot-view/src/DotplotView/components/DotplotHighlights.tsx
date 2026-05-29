import { colord } from '@jbrowse/core/util/colord'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import DotplotHighlightBands from './DotplotHighlightBands.tsx'

import type { DotplotViewModel } from '../model.ts'

const DotplotHighlights = observer(function DotplotHighlights({
  model,
}: {
  model: DotplotViewModel
}) {
  const theme = useTheme()
  return model.highlightsVisible
    ? model.highlight.map((h, i) => {
        // user-supplied color is used as-is so explicit alpha is preserved;
        // otherwise fall back to the theme highlight color at a standard alpha
        const color = h.color
          ? colord(h.color)
          : colord(theme.palette.highlight.main).alpha(0.35)
        return (
          <DotplotHighlightBands
            key={`${h.assemblyName}-${h.refName}-${h.start}-${h.end}-${i}`}
            model={model}
            region={h}
            color={color.toRgbString()}
          />
        )
      })
    : null
})

export default DotplotHighlights
