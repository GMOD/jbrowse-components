import React, { Suspense, lazy } from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

// adds a suspense to the lazy AboutDialog
export default function AboutDialogFallback(props: {
  config: AnyConfigurationModel
  handleClose: () => void
}) {
  return (
    <Suspense fallback={<div />}>
      <AboutDialog {...props} />
    </Suspense>
  )
}
