import { observer } from 'mobx-react'

import LocationLink from './LocationLink.tsx'

const MateCell = observer(function MateCell({
  model,
  locString,
  display,
}: {
  model: { assemblyName?: string }
  locString: string
  display: string
}) {
  return model.assemblyName ? (
    <LocationLink model={model} locString={locString}>
      {display}
    </LocationLink>
  ) : (
    <>{display}</>
  )
})

export default MateCell
