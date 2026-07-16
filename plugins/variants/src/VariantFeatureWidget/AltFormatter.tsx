import { useState } from 'react'

import { getBpDisplayStr } from '@jbrowse/core/util'

import { getMinimalDesc } from '../VcfFeature/util.ts'

function getDetail({
  value,
  svlen,
  mate,
}: {
  value: string
  svlen?: number
  mate?: string
}) {
  if (value === '<TRA>') {
    return mate === undefined ? '' : ` (${mate})`
  }
  return value.startsWith('<') && svlen !== undefined
    ? ` (${getBpDisplayStr(Math.abs(svlen))})`
    : ''
}

export default function AltFormatter({
  value,
  refString,
  svlen,
  mate,
}: {
  value: string
  refString: string
  svlen?: number
  mate?: string
}) {
  const [show, setShow] = useState(false)
  const alt = getMinimalDesc(refString, value)
  const detail = getDetail({ value, svlen, mate })
  return alt !== value ? (
    <div>
      <button
        onClick={() => {
          setShow(!show)
        }}
      >
        {show ? 'Show simplified ALT' : 'Show raw ALT'}
      </button>{' '}
      {show ? value : alt}
    </div>
  ) : (
    `${value}${detail}`
  )
}
