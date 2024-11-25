import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  Checkbox,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

function ellipses(slug: string) {
  return slug.length > 20 ? `${slug.slice(0, 20)}...` : slug
}

const useStyles = makeStyles()(theme => ({
  connectionContainer: {
    width: 500,
    margin: theme.spacing(4),
  },
}))

const ConnectionRow = observer(function ConnectionRow({
  conf,
  session,
  breakConnection,
}: {
  conf: AnyConfigurationModel
  session: AbstractSessionModel
  breakConnection: (arg: AnyConfigurationModel) => void
}) {
  const { connectionInstances: instances = [] } = session
  const name = readConfObject(conf, 'name')
  const assemblyNames = readConfObject(conf, 'assemblyNames')
  const found = instances.find(conn => name === conn.name)
  return (
    <FormControlLabel
      key={conf.connectionId}
      control={
        <Checkbox
          checked={!!found}
          onChange={() => {
            if (found) {
              breakConnection(conf)
            } else {
              session.makeConnection?.(conf)
            }
          }}
          color="primary"
        />
      }
      label={[
        name,
        assemblyNames.length ? `(${ellipses(assemblyNames.join(','))})` : '',
      ]
        .filter(f => !!f)
        .join(' ')}
    />
  )
})

const ConnectionList = observer(function ConnectionsList({
  session,
  breakConnection,
}: {
  session: AbstractSessionModel
  breakConnection: (arg: AnyConfigurationModel) => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.connectionContainer}>
      {!session.connections.length ? (
        <Typography>No connections found</Typography>
      ) : (
        session.connections.map((conf, idx) => (
          <div key={`${conf.name}_${idx}`}>
            <ConnectionRow
              conf={conf}
              session={session}
              breakConnection={breakConnection}
            />
          </div>
        ))
      )}
    </div>
  )
})

const ToggleConnectionDialog = observer(function ({
  session,
  handleClose,
  breakConnection,
}: {
  handleClose: () => void
  session: AbstractSessionModel
  breakConnection: (arg: AnyConfigurationModel) => void
}) {
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="lg"
      title="Turn on/off connections"
    >
      <DialogContent>
        <Typography>Use the checkbox to turn on/off connections</Typography>
        <ConnectionList session={session} breakConnection={breakConnection} />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ToggleConnectionDialog
