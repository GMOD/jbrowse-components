import { observer } from 'mobx-react'

const HeadingComponent = observer(function HeadingComponent({
  model,
}: {
  model?: {
    target?: { trackId?: string }
  }
}) {
  return model?.target?.trackId ? 'Track settings' : 'Settings'
})

export default HeadingComponent
