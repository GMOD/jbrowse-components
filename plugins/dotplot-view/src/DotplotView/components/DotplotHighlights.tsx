import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import DotplotHighlightBands from './DotplotHighlightBands.tsx'
import { getHighlightColor } from './highlightUtils.ts'

import type { DotplotViewModel } from '../model.ts'

const DotplotHighlights = observer(function DotplotHighlights({
  model,
}: {
  model: DotplotViewModel
}) {
  const theme = useTheme()
  return model.highlightsVisible
    ? model.highlight.map((h, i) => (
        <DotplotHighlightBands
          key={`${h.assemblyName}-${h.refName}-${h.start}-${h.end}-${i}`}
          model={model}
          region={h}
          color={getHighlightColor(h, theme).toRgbString()}
        />
      ))
    : null
})

export default DotplotHighlights
