import React from 'react'
import { observer } from 'mobx-react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { makeStyles } from 'tss-react/mui'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

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
