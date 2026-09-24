import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { getSession } from '@jbrowse/core/util'
import { highlightKey } from '@jbrowse/core/util/highlights'
import { observer } from 'mobx-react'

import DotplotHighlightBands from './DotplotHighlightBands.tsx'
import { getHighlightColor } from './highlightUtils.ts'

import type { DotplotViewModel } from '../model.ts'

const DotplotHighlights = observer(function DotplotHighlights({
  model,
}: {
  model: DotplotViewModel
}) {
  const theme = useStyleTheme()
  return getSession(model).highlightsVisible
    ? model.highlights.map((h, i) => (
        <DotplotHighlightBands
          key={highlightKey(h, i)}
          model={model}
          region={h}
          color={getHighlightColor(h, theme).toRgbString()}
        />
      ))
    : null
})

export default DotplotHighlights
