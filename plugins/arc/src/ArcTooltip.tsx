import React, { Suspense } from 'react'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

interface Props {
  message: React.ReactNode | string
}
const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {React.isValidElement(message) ? (
          message
        ) : message ? (
          <SanitizedHTML html={String(message)} />
        ) : null}
      </div>
    )
  },
)

const ArcTooltip = observer(function ({ contents }: { contents?: string }) {
  return contents ? (
    <Suspense fallback={null}>
      <BaseTooltip>
        <TooltipContents message={contents} />
      </BaseTooltip>
    </Suspense>
  ) : null
})

export default ArcTooltip
