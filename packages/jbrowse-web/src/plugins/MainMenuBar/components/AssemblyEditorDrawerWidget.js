import Avatar from '@material-ui/core/Avatar'
import Button from '@material-ui/core/Button'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import Divider from '@material-ui/core/Divider'
import Fab from '@material-ui/core/Fab'
import Grow from '@material-ui/core/Grow'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemAvatar from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import Paper from '@material-ui/core/Paper'
import Popper from '@material-ui/core/Popper'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/core/styles'
import { inject, observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { readConfObject } from '../../../configuration'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  paper: {
    marginBottom: theme.spacing.unit,
  },
  assembly: {
    marginBottom: theme.spacing.unit,
  },
  listNumber: {
    width: 24,
    height: 24,
    fontSize: '80%',
  },
  fab: {
    float: 'right',
    position: 'sticky',
    'margin-top': theme.spacing.unit * 2,
    bottom: theme.spacing.unit * 2,
    right: theme.spacing.unit * 2,
  },
  menu: {
    padding: theme.spacing.unit * 2,
  },
  menuButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
})

@withStyles(styles)
@inject('rootModel')
@observer
class AssemblyEditorDrawerWidget extends React.Component {
  static propTypes = {
    rootModel: MobxPropTypes.observableObject.isRequired,
    classes: propTypes.objectOf(propTypes.string).isRequired,
  }

  state = {
    anchorEl: null,
    newAssemblyName: '',
  }

  handleFabClick = event => this.setState({ anchorEl: event.currentTarget })

  handleFabClose = () => this.setState({ anchorEl: null })

  handleNewAssemblyChange = event =>
    this.setState({ newAssemblyName: event.target.value })

  render() {
    const { anchorEl, newAssemblyName } = this.state
    const { classes, rootModel } = this.props
    return (
      <div className={classes.root}>
        {Array.from(rootModel.configuration.assemblies, ([key, val]) => (
          <Card className={classes.assembly} key={key}>
            <CardHeader
              title={key}
              action={
                <>
                  <IconButton
                    onClick={() =>
                      rootModel.editConfiguration(
                        rootModel.configuration.assemblies.get(key),
                      )
                    }
                  >
                    <Icon>edit</Icon>
                  </IconButton>
                  <IconButton
                    onClick={() => rootModel.configuration.removeAssembly(key)}
                  >
                    <Icon>delete</Icon>
                  </IconButton>
                </>
              }
            />
            <CardContent>
              <Paper className={classes.paper}>
                <List dense subheader={<ListSubheader>Aliases:</ListSubheader>}>
                  <Divider />
                  {readConfObject(val, 'aliases').map((alias, idx) => (
                    <ListItem key={alias}>
                      <ListItemAvatar>
                        <Avatar className={classes.listNumber}>
                          {idx + 1}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText>{alias}</ListItemText>
                    </ListItem>
                  ))}
                </List>
              </Paper>
              <Paper>
                <List
                  dense
                  subheader={
                    <ListSubheader>Reference Sequence Aliases:</ListSubheader>
                  }
                >
                  <Divider />
                  {Object.entries(readConfObject(val, 'seqNameAliases')).map(
                    ([seqName, aliases]) => (
                      <List
                        key={seqName}
                        dense
                        subheader={<ListSubheader>{seqName}</ListSubheader>}
                      >
                        {aliases.map((alias, idx) => (
                          <ListItem key={alias}>
                            <ListItemAvatar>
                              <Avatar className={classes.listNumber}>
                                {idx + 1}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText>{alias}</ListItemText>
                          </ListItem>
                        ))}
                        <Divider />
                      </List>
                    ),
                  )}
                </List>
              </Paper>
            </CardContent>
          </Card>
        ))}
        <Fab
          color="secondary"
          className={classes.fab}
          onClick={this.handleFabClick}
        >
          <Icon>add</Icon>
        </Fab>
        <Popper anchorEl={anchorEl} open={Boolean(anchorEl)} transition>
          <Grow in={Boolean(anchorEl)}>
            <Paper className={classes.menu}>
              <ClickAwayListener onClickAway={this.handleFabClose}>
                <div>
                  <Typography
                    component="p"
                    variant="subtitle1"
                    color="textSecondary"
                  >
                    Enter the name of the new assembly
                  </Typography>
                  <TextField
                    autoFocus
                    label="Assembly name"
                    value={newAssemblyName}
                    onChange={this.handleNewAssemblyChange}
                  />
                  <div className={classes.menuButtons}>
                    <Button color="secondary" onClick={this.handleFabClose}>
                      Cancel
                    </Button>
                    <Button
                      color="secondary"
                      onClick={() => {
                        this.handleFabClose()
                        rootModel.configuration.addAssembly(newAssemblyName)
                        this.setState({ newAssemblyName: '' })
                      }}
                      disabled={!newAssemblyName}
                    >
                      Add assembly
                    </Button>
                  </div>
                </div>
              </ClickAwayListener>
            </Paper>
          </Grow>
        </Popper>
      </div>
    )
  }
}

export default AssemblyEditorDrawerWidget
