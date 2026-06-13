import { useState } from 'react'

import { getBpDisplayStr } from '@jbrowse/core/util'

import { getMinimalDesc } from '../VcfFeature/util.ts'

export default function AltFormatter({
  value,
  refString,
  svlen,
}: {
  value: string
  refString: string
  svlen?: number
}) {
  const [show, setShow] = useState(false)
  const alt = getMinimalDesc(refString, value)
  const svlenStr =
    value.startsWith('<') && svlen !== undefined
      ? ` (${getBpDisplayStr(Math.abs(svlen))})`
      : ''
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
    `${value}${svlenStr}`
  )
}
