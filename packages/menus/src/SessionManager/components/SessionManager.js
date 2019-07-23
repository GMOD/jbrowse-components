import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Icon from '@material-ui/core/Icon'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react-lite'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
}))

export default observer(({ session }) => {
  const classes = useStyles()

  return (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Choose a session to open</ListSubheader>}>
        {session.savedSessions.map(sessionSnapshot => {
          const { views = [] } = sessionSnapshot
          const openTrackCount = views.map(view => (view.tracks || []).length)
          let viewDetails
          switch (views.length) {
            case 0: {
              viewDetails = '0 views'
              break
            }
            case 1: {
              viewDetails = `1 view, ${openTrackCount[0]} open track${
                openTrackCount[0] === 1 ? '' : 's'
              }`
              break
            }
            case 2: {
              viewDetails = `2 views; ${openTrackCount[0]} and ${
                openTrackCount[1]
              } open tracks`
              break
            }
            default: {
              viewDetails = `${views.length} views; ${openTrackCount
                .slice(0, views.length - 1)
                .join(', ')}, and ${
                openTrackCount[views.length - 1]
              } open tracks`
              break
            }
          }
          return (
            <ListItem
              button
              onClick={() => session.activateSession(sessionSnapshot.name)}
              key={sessionSnapshot.name}
            >
              <ListItemIcon>
                <Icon>view_list</Icon>
              </ListItemIcon>
              <ListItemText
                primary={sessionSnapshot.name}
                secondary={viewDetails}
              />
            </ListItem>
          )
        })}
      </List>
    </Paper>
  )
})
