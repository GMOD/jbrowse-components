import React from 'react'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

const SyntenyTooltip = observer(function ({ title }: { title: string }) {
  return title ? (
    <BaseTooltip>
      <SanitizedHTML html={title} />
    </BaseTooltip>
  ) : null
})

export default SyntenyTooltip
