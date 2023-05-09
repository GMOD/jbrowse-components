import React, { Suspense, lazy } from 'react'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

// adds a suspense to the lazy AboutDialog
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AboutDialogFallback(props: Record<string, any>) {
  return (
    <Suspense fallback={<div />}>
      {/*
      // @ts-expect-error*/}
      <AboutDialog {...props} />
    </Suspense>
  )
}
