import Card from '@material-ui/core/Card'
import CardHeader from '@material-ui/core/CardHeader'
import CardMedia from '@material-ui/core/CardMedia'
import IconButton from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import DeleteIcon from '@material-ui/icons/Delete'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import TextFieldsIcon from '@material-ui/icons/TextFields'
import PropTypes from 'prop-types'
import React, { useState } from 'react'

const useStyles = makeStyles({
  card: {
    width: 250,
    cursor: 'pointer',
  },
  cardHeader: {
    width: 200,
  },
  media: {
    height: 0,
    paddingTop: '56.25%', // 16:9
  },
})

function RecentSessionCard({
  sessionName,
  sessionStats,
  sessionScreenshot,
  onClick,
  onDelete,
  onRename,
}) {
  const classes = useStyles()
  const [hovered, setHovered] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState(null)

  function onMenuClick(event) {
    event.stopPropagation()
    setMenuAnchorEl(event.currentTarget)
  }

  const handleMenuClose = action => {
    setMenuAnchorEl(null)
    if (action === 'delete') {
      return onDelete(sessionName)
    }
    if (action === 'rename') {
      return onRename(sessionName)
    }
    return undefined
  }

  return (
    <>
      <Card
        className={classes.card}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        onClick={() => onClick(sessionName)}
        raised={Boolean(hovered)}
      >
        <CardMedia className={classes.media} image={sessionScreenshot} />
        <CardHeader
          action={
            <IconButton onClick={onMenuClick}>
              <MoreVertIcon color="secondary" />
            </IconButton>
          }
          disableTypography
          title={
            <Tooltip title={sessionName} enterDelay={300}>
              <Typography variant="body2" noWrap style={{ width: 178 }}>
                {sessionName}
              </Typography>
            </Tooltip>
          }
          subheader={
            <Typography
              variant="body2"
              color="textSecondary"
              noWrap
              style={{ width: 178 }}
            >
              Last modified{' '}
              {new Date(sessionStats?.mtimeMs).toLocaleDateString(undefined, {
                dateStyle: 'medium',
              })}
            </Typography>
          }
        />
      </Card>
      <Menu
        id="simple-menu"
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuClose('rename')}>
          <ListItemIcon>
            <TextFieldsIcon color="secondary" />
          </ListItemIcon>
          <Typography variant="inherit">Rename</Typography>
        </MenuItem>
        <MenuItem onClick={() => handleMenuClose('delete')}>
          <ListItemIcon>
            <DeleteIcon color="secondary" />
          </ListItemIcon>
          <Typography variant="inherit">Delete</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

RecentSessionCard.propTypes = {
  sessionName: PropTypes.string.isRequired,
  sessionStats: PropTypes.shape({ mtimeMs: PropTypes.number }).isRequired,
  sessionScreenshot: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
}

RecentSessionCard.defaultProps = {
  sessionScreenshot:
    'data:image/png;base64,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',
}

export default RecentSessionCard
