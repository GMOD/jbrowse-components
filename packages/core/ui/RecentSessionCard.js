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
    if (action === 'delete') return onDelete(sessionName)
    if (action === 'rename') return onRename(sessionName)
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
              {new Date(sessionStats.mtimeMs).toLocaleDateString(undefined, {
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
            <TextFieldsIcon color="secondary" fontSize="small" />
          </ListItemIcon>
          <Typography variant="inherit">Rename</Typography>
        </MenuItem>
        <MenuItem onClick={() => handleMenuClose('delete')}>
          <ListItemIcon>
            <DeleteIcon color="secondary" fontSize="small" />
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
