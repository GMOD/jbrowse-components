import { navToLoc } from '@jbrowse/sv-core'
import { Link } from '@mui/material'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'

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
        navToLoc(locString, model)
      }}
      href="#"
    >
      {locString}
    </Link>
  )
}
