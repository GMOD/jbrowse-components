// will move later, just putting here tempimport React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation, AuthLocation } from '@jbrowse/core/util/types'
import { searchOrReplaceInArgs } from '@jbrowse/core/util'
import { ExternalTokenInternetAccountConfigModel } from './configSchema'
import { Instance, types } from 'mobx-state-tree'
import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import TextField from '@material-ui/core/TextField'
import WarningIcon from '@material-ui/icons/Warning'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const useStyles = makeStyles(theme => ({
  main: {
    textAlign: 'center',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
  },
  buttons: {
    margin: theme.spacing(2),
    color: theme.palette.text.primary,
  },
}))

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: ExternalTokenInternetAccountConfigModel,
) => {
  return types
    .compose(
      'ExternalTokenInternetAccount',
      InternetAccount,
      types.model({
        id: 'ExternalToken',
        type: types.literal('ExternalTokenInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      externalToken: '',
      currentTypeAuthorizing: '',
      needsToken: false,
    }))
    .views(self => ({
      handlesLocation(location: FileLocation): boolean {
        // this will probably look at something in the config which indicates that it is an OAuth pathway,
        // also look at location, if location is set to need authentication it would reutrn true
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          (location as AuthLocation)?.uri.includes(domain),
        )
      },
    }))
    .actions(self => ({
      async fetchFile(location: string) {
        if (!location || !self.externalToken) {
          return
        }
        // add a fetch call for gdc adding the token to the header, or place the header into
        // sessionstorage for fetch to use
      },
      openFieldForExternalToken() {
        // open a dialog box that has a text field for pasting a token
        // something like
        // <DialogBoxExternal setExternalToken={this.setExternalToken}
        // could do window.prompt, so similar flow to window.open, can get info from the prompt
        return (
          <ExternalTokenEntryForm
            internetAccountId={self.internetAccountId}
            setExternalToken={this.setExternalToken}
          />
        )
      },
      setExternalToken(token: string) {
        self.externalToken = token
      },
      setNeedsToken(bool: boolean) {
        self.needsToken = bool
      },
      getOrSetExternalToken() {
        if (!self.needsToken) {
          return ''
        }
        const tokenKey = Object.keys(sessionStorage).find(key => {
          return key === `${self.accountConfig.internetAccountId}-token`
        })
        let token = sessionStorage.getItem(tokenKey as string)

        // prompt user for token if there isnt one existing
        // if a user doesnt enter a token allow them to continue without token

        // for GDC there is a way to tell if it needs a token or not
        // first call is an api endpoint, you get metadata for the file and has a property
        // called access, if access is set to controller it needs a token, else it doesn't
        if (!token) {
          const newToken = window.prompt(
            `Enter token for ${self.accountConfig.internetAccountId} to use`,
          )
          if (!newToken) {
            return
          }
          token = newToken
          sessionStorage.setItem(
            `${self.accountConfig.internetAccountId}-token`,
            token,
          )
        }

        return token
      },
      async openLocation(location: FileLocation) {
        let token = ''

        switch (self.accountConfig.internetAccountId) {
          case 'GDCExternalToken': {
            const query = (location as AuthLocation).uri.split('/').pop() // should get id
            const response = await fetch(
              `https://api.gdc.cancer.gov/files/${query}?expand=index_files`,
              {
                method: 'GET',
              },
            )

            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(
                `Network response failure: ${response.status} (${errorText})`,
              )
            }

            const metadata = await response.json()
            if (metadata) {
              metadata.access === 'controlled'
                ? this.setNeedsToken(true)
                : this.setNeedsToken(false)
            }

            token = this.getOrSetExternalToken()
          }
        }

        return token
      },
      handleRpcMethodCall(
        location: FileLocation,
        authenticationInfoMap: Record<string, string>,
        args: {},
      ) {
        this.openLocation(location)

        switch (self.accountConfig.internetAccountId) {
          case 'GDCExternalToken': {
            const query = (location as AuthLocation).uri.split('/').pop() // should get id
            const editedArgs = JSON.parse(JSON.stringify(args))
            searchOrReplaceInArgs(
              editedArgs,
              'uri',
              `https://api.gdc.cancer.gov/data/${query}`,
            )
            return editedArgs
          }
        }
      },
    }))
}

const ExternalTokenEntryForm = ({
  internetAccountId,
  setExternalToken,
}: {
  internetAccountId: string
  setExternalToken: (token: string) => void
}) => {
  const classes = useStyles()
  const [open, setOpen] = useState(true)
  const [tokenInForm, setTokenInForm] = useState('')
  return (
    <Dialog
      open={open}
      maxWidth="xl"
      data-testid="external-token-modal"
      className={classes.main}
    >
      <DialogTitle>External Token Form</DialogTitle>
      <Divider />
      <div>
        <WarningIcon fontSize="large" />
        <DialogContent>
          <DialogContentText>
            {' '}
            Paste token for use with {internetAccountId} below
          </DialogContentText>
        </DialogContent>
        <div>
          <TextField
            value={tokenInForm}
            onChange={event => {
              setTokenInForm(event.target.value)
            }}
            label="Paste Token Here"
            autoComplete="off"
            size="medium"
          />
        </div>
        <div className={classes.buttons}>
          <Button
            color="primary"
            variant="contained"
            style={{ marginRight: 5 }}
            onClick={async () => {
              setExternalToken(tokenInForm)
            }}
          >
            Add Token
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setOpen(false)
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
