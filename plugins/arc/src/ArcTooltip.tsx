import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'

export default function ArcTooltip({ contents }: { contents?: string }) {
  return contents ? (
    <BaseTooltip>
      <div>
        <SanitizedHTML html={contents} />
      </div>
    </BaseTooltip>
  ) : null
}
