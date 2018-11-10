import Modal from '@material-ui/core/Modal'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  paper: {
    position: 'absolute',
    width: theme.spacing.unit * 50,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing.unit * 4,
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%)`,
  },
})

function AboutModal(props) {
  const { classes, onClose } = props

  return (
    <Modal
      aria-labelledby="simple-modal-title"
      aria-describedby="simple-modal-description"
      open
      onClose={onClose}
    >
      <div className={classes.paper}>
        <Typography variant="h6" id="modal-title">
          About JBrowse
        </Typography>
        <Typography variant="subtitle1" id="simple-modal-description">
          Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
        </Typography>
      </div>
    </Modal>
  )
}

AboutModal.propTypes = {
  classes: PropTypes.shape().isRequired,
  onClose: PropTypes.func.isRequired,
}

export default withStyles(styles)(AboutModal)
