import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// named after its search, so the drawer's widget picker tells several apart
const HeadingComponent = observer(function HeadingComponent({
  model,
}: {
  model?: { trackName?: string }
}) {
  return (
    <Typography variant="h6" color="inherit">
      {model?.trackName ?? 'Search results'}
    </Typography>
  )
})

export default HeadingComponent
