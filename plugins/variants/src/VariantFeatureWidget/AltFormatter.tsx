import { useState } from 'react'

import { getMinimalDesc } from '../VcfFeature/util'

export default function AltFormatter({
  value,
  ref,
}: {
  value: string
  ref: string
}) {
  const [show, setShow] = useState(false)
  const alt = getMinimalDesc(ref, value)
  return alt !== value ? (
    <div>
      <button
        onClick={() => {
          setShow(!show)
        }}
      >
        {show ? 'Show simplified ALT' : 'Show raw ALT'}
      </button>{' '}
      {show ? value : getMinimalDesc(ref, value)}
    </div>
  ) : (
    value
  )
}
