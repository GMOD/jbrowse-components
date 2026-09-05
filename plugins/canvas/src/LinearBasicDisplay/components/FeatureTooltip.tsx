import { SanitizedHTML } from '@jbrowse/core/ui'
import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { observer } from 'mobx-react'

import type { MouseState } from '@jbrowse/core/ui'

// One element per row rather than one `<br/>`-joined string, so DOMPurify judges
// markup-or-text on each row's own text instead of on the join.
const FeatureTooltip = observer(function FeatureTooltip({
  rows,
  mouseState,
}: {
  rows: string[] | undefined
  mouseState: MouseState | undefined
}) {
  return (
    <HoverTooltip hit={rows?.length} mouseState={mouseState}>
      {rows?.map((row, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- row position IS the identity here; the rows are positional and the list is rebuilt whole per hover
        <div key={i}>
          <SanitizedHTML html={row} />
        </div>
      ))}
    </HoverTooltip>
  )
})

export default FeatureTooltip
