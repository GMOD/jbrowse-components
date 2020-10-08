import React from 'react'
import Button from '@material-ui/core/Button'
import SaveAltIcon from '@material-ui/icons/SaveAlt'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'

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

  // Saves the session at current point in time to local storage
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
