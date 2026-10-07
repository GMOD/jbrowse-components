import { useState } from 'react'

import { ActionLink } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { getMinimalDesc } from '../VcfFeature/util.ts'

function getDetail({
  value,
  bp,
  mate,
}: {
  value: string
  bp?: number
  mate?: string
}) {
  if (value === '<TRA>') {
    return mate === undefined ? '' : ` (${mate})`
  }
  return value.startsWith('<') && bp !== undefined
    ? ` (${getBpDisplayStr(bp)})`
    : ''
}

const AltFormatter = observer(function AltFormatter({
  value,
  refString,
  bp,
  mate,
}: {
  value: string
  refString: string
  bp?: number
  mate?: string
}) {
  const [show, setShow] = useState(false)
  const alt = getMinimalDesc(refString, value)
  const detail = getDetail({ value, bp, mate })
  return alt !== value ? (
    <div>
      <ActionLink
        onClick={() => {
          setShow(!show)
        }}
      >
        {show ? 'Show simplified ALT' : 'Show raw ALT'}
      </ActionLink>{' '}
      {show ? value : alt}
      {detail}
    </div>
  ) : (
    `${value}${detail}`
  )
})

export default AltFormatter
