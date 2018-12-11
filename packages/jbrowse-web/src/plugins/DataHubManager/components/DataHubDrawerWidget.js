import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import React from 'react'

function About() {
  return (
    <Typography variant="h6">
      Here is some information about data hubs
    </Typography>
  )
}

export default observer(About)
