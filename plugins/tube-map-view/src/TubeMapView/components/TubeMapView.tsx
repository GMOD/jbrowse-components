import { observer } from 'mobx-react'

import ImportForm from './ImportForm.tsx'
import TubeMapCanvas from './TubeMapCanvas.tsx'
import TubeMapToolbar from './TubeMapToolbar.tsx'

import type { TubeMapViewModel } from '../model.ts'

const TubeMapView = observer(function TubeMapView({
  model,
}: {
  model: TubeMapViewModel
}) {
  if (model.hasLayout) {
    return (
      <div>
        <TubeMapToolbar model={model} />
        <TubeMapCanvas model={model} />
      </div>
    )
  }
  return <ImportForm model={model} />
})

export default TubeMapView
