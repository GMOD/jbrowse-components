import React from 'react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()({
  container: {
    overflow: 'auto',
    maxHeight: 600,
  },
})
const AssemblyEditor = observer(function ({
  assembly,
}: {
  assembly?: AnyConfigurationModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.container}>
      {assembly ? (
        <ConfigurationEditor model={{ target: assembly }} />
      ) : (
        <div>No assembly</div>
      )}
    </div>
  )
})

export default AssemblyEditor
