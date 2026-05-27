import { useMemo, useState } from 'react'

import { getBpDisplayStr } from '@jbrowse/core/util'

import { getMinimalDesc } from '../VcfFeature/util.ts'

export default function AltFormatter({
  value,
  refString,
  svlen,
}: {
  value: string
  refString: string
  svlen?: number[]
}) {
  const [show, setShow] = useState(false)
  const alt = useMemo(
    () => getMinimalDesc(refString, value),
    [refString, value],
  )
  const svlenStr =
    value.startsWith('<') && svlen !== undefined && svlen.length > 0
      ? ` (${svlen.map(s => getBpDisplayStr(Math.abs(s))).join(', ')})`
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
