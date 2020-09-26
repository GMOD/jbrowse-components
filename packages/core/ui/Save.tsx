import React, { useState, useEffect } from 'react'
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
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Save = observer((props: { session: any }) => {
  const { session } = props
  const classes = useStyles()

  const [saved, setSaved] = useState(false)

  // TODOSESSION: if sessionStorage used, this can be improved
  useEffect(() => {
    if (!session.name.endsWith('-saved')) setSaved(false)
  }, [session.name])

  return (
    <div className={classes.saveDiv}>
      {saved ? (
        <Button
          data-testid="saved_button"
          size="small"
          color="inherit"
          startIcon={<DoneIcon />}
          classes={{ root: classes.savedButton }}
        >
          Saved
        </Button>
      ) : (
        <Button
          data-testid="save_button"
          onClick={() => {
            session.saveSessionToLocalStorage()
            setSaved(true)
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
