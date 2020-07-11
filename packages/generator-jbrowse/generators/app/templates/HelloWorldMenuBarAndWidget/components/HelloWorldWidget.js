import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import React from 'react'

function HelloWorld() {
  return <Typography variant="h3">Hello, World!</Typography>
}

export default observer(HelloWorld)
