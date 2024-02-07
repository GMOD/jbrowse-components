import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'

const StaticViewWrapper = observer(function ({
  children,
}: {
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])
  return <div>{children}</div>
})

export default StaticViewWrapper
