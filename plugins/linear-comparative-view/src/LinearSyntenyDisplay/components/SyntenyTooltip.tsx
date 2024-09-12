import React from 'react'
import { observer } from 'mobx-react'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'

const SyntenyTooltip = observer(function ({ title }: { title: string }) {
  return title ? (
    <BaseTooltip>
      <SanitizedHTML html={title} />
    </BaseTooltip>
  ) : null
})

export default SyntenyTooltip
