import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import SaveAltIcon from '@material-ui/icons/SaveAlt'
import DoneIcon from '@material-ui/icons/Done'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
// TODO SESSION remove all references to useUrlSession
const useStyles = makeStyles(theme => ({
  saveDiv: {
    textAlign: 'center',
    paddingLeft: '2px',
  },
  saveButton: {
    '&:hover': {
      backgroundColor: fade(
        theme.palette.primary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  savedButton: {
    '@media (hover: none)': {
      backgroundColor: 'transparent',
    },
    '&:disabled': {
      color: 'inherit',
    },
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Save = observer((props: { session: any }) => {
  const { session } = props
  const classes = useStyles()
  // const locationUrl = new URL(window.location.href)
  // const params = new URLSearchParams(locationUrl.search)

  // TODOSESSION: need to refactor this, dont like how it looks
  console.log(session, session.name.endsWith('-saved'))
  const [saved, setSaved] = useState(session.name.endsWith('-saved'))
  if (session.name.endsWith('-saved') !== saved)
    setSaved(session.name.endsWith('-saved'))
  // on new session or tab exit, if they are on an unsaved session, have some dialog saying
  // are you sure, this is unsaved and give them an action button to save

  // for autosave: generate autosave everytime someone is working on an unsaved session
  // and makes changes. clear when they click save or they start working on a saved session 'localSaved in url'
  // autosave is only if they close their tab and they had unsaved
  // call button or link Recover last unsaved session
  return (
    <div className={classes.saveDiv}>
      {saved ? (
        <Button
          data-testid="saved_button"
          size="small"
          color="inherit"
          startIcon={<DoneIcon />}
          classes={{ root: classes.savedButton }}
          disabled
        >
          Saved
        </Button>
      ) : (
        <Button
          data-testid="save_button"
          onClick={() => {
            session.saveSessionToLocalStorage(true)
            setSaved(true)
            if (localStorage.getItem('autosave'))
              localStorage.removeItem('autosave')
          }}
          size="small"
          color="inherit"
          startIcon={<SaveAltIcon />}
          classes={{ root: classes.saveButton }}
        >
          Save
        </Button>
      )}
    </div>
  )
})

export default Save
