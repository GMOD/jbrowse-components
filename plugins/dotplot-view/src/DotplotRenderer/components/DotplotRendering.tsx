import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { DotplotRenderArgsDeserialized } from '../DotplotRenderer'

const DotplotRendering = observer(function (
  props: DotplotRenderArgsDeserialized,
) {
  return <PrerenderedCanvas {...props} />
})

export default DotplotRendering
