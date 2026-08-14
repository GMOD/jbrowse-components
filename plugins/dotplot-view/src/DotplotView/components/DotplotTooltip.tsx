import { Fragment } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { PointerSample } from './useDotplotInteraction.ts'

/**
 * The one tooltip the plot area shows, anchored on the pointer. Its lines are
 * resolved by the caller — the cursor's two axis coordinates, or the hovered
 * alignment's `tooltipLines`.
 *
 * Lines as text nodes, deliberately: a refName comes out of a file and can hold
 * anything, so nothing here is HTML and there is no sanitizer on the path. The
 * synteny tooltip joins its lines with `<br/>` and pays for a `SanitizedHTML`.
 */
const DotplotTooltip = observer(function DotplotTooltip({
  lines,
  point,
  placement,
}: {
  lines: string[]
  point: PointerSample
  placement: 'left' | 'right'
}) {
  return (
    <BaseTooltip
      placement={placement}
      clientPoint={{ x: point.clientX, y: point.clientY }}
    >
      {lines.map((line, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- the caller rebuilds the whole list per hover; a line has no identity of its own and can repeat
        <Fragment key={`${i}-${line}`}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </BaseTooltip>
  )
})

export default DotplotTooltip
