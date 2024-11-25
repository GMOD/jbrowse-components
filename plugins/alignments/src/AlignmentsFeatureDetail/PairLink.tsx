import React from 'react'
import { Link } from '@mui/material'

// locals
import { navToLoc } from './util'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'

export default function PairLink({
  locString,
  model,
}: {
  locString: string
  model: AlignmentFeatureWidgetModel
}) {
  return (
    <Link
      onClick={event => {
        event.preventDefault()
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        navToLoc(locString, model)
      }}
      href="#"
    >
      {locString}
    </Link>
  )
}
