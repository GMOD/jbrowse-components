import { observer } from 'mobx-react'

import HatchCircle from './HatchCircle.tsx'

const DisplayError = observer(function DisplayError({
  model,
  radius,
}: {
  model: { error: unknown }
  radius: number
}) {
  return (
    <HatchCircle
      radius={radius}
      fill="#ffb4b4"
      hatchColor="rgba(255,0,0,0.5)"
      text={String(model.error)}
    />
  )
})

export default DisplayError
