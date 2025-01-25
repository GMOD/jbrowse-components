import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { useEffect } from 'react'

const LinearVariantMatrixRendering = observer(function (props: {
  width: number
  height: number
  hasPhased: boolean
  displayModel: any
}) {
  console.log(props)
  const { displayModel, hasPhased } = props
  useEffect(() => {
    displayModel.setHasPhased(hasPhased)
  }, [])
  return <PrerenderedCanvas {...props} />
})

export default LinearVariantMatrixRendering
