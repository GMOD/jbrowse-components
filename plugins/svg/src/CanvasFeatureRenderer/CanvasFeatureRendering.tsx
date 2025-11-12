import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const CanvasFeatureRendering = observer(function (props: {
  blockKey: string
  width: number
  height: number
}) {
  return <PrerenderedCanvas {...props} />
})

export default CanvasFeatureRendering
