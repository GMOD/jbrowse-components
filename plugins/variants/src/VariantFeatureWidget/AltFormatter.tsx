import { useMemo, useState } from 'react'

import { getMinimalDesc } from '../VcfFeature/util'

export default function AltFormatter({
  value,
  refString,
}: {
  value: string
  refString: string
}) {
  const [show, setShow] = useState(false)
  const alt = useMemo(
    () => getMinimalDesc(refString, value),
    [refString, value],
  )
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
    value
  )
}
