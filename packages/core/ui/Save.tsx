import React from 'react'
import Button from '@material-ui/core/Button'
import SaveAltIcon from '@material-ui/icons/SaveAlt'
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
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Save = observer((props: { session: any }) => {
  const { session } = props
  const classes = useStyles()

  // for autosave: generate autosave everytime someone is working on an unsaved session
  // and makes changes. clear when they click save or they start working on a saved session 'localSaved in url'
  // autosave is only if they close their tab and they had unsaved
  // call button or link Recover last unsaved session
  return (
    <div className={classes.saveDiv}>
      <Button
        data-testid="save_button"
        onClick={() => {
          session.saveSessionToLocalStorage()
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
    </div>
  )
})

export default Save
