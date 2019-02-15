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
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React from 'react'
import { readConfObject } from '../../../configuration'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
  },
  headerText: {
    flex: 'auto',
  },
  paper: {
    marginBottom: theme.spacing.unit,
  },
  popper: {
    zIndex: theme.zIndex.drawer + 50,
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
    maxWidth: 400,
  },
  menuButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
})

class AssemblyEditorDrawerWidget extends React.Component {
  static propTypes = {
    model: MobxPropTypes.observableObject.isRequired,
    classes: propTypes.objectOf(propTypes.string).isRequired,
  }

  state = {
    addMenuAnchorEl: null,
    helpMenuAnchorEl: null,
    newAssemblyName: '',
  }

  handleFabClick = event => {
    const { addMenuAnchorEl } = this.state
    this.setState({
      addMenuAnchorEl: addMenuAnchorEl ? null : event.currentTarget,
    })
  }

  handleHelpClick = event => {
    const { helpMenuAnchorEl } = this.state
    this.setState({
      helpMenuAnchorEl: helpMenuAnchorEl ? null : event.currentTarget,
    })
  }

  handleFabClose = event => {
    const { addMenuAnchorEl } = this.state
    if (addMenuAnchorEl && addMenuAnchorEl.contains(event.target)) return
    this.setState({ addMenuAnchorEl: null })
  }

  handleHelpClose = event => {
    const { helpMenuAnchorEl } = this.state
    if (helpMenuAnchorEl && helpMenuAnchorEl.contains(event.target)) return
    this.setState({ helpMenuAnchorEl: null })
  }

  handleNewAssemblyChange = event =>
    this.setState({ newAssemblyName: event.target.value })

  handleAddAssembly = event => {
    const { newAssemblyName } = this.state
    const { model } = this.props
    const rootModel = getRoot(model)
    this.handleFabClose(event)
    rootModel.configuration.addAssembly(newAssemblyName)
    this.setState({ newAssemblyName: '' })
  }

  render() {
    const { addMenuAnchorEl, helpMenuAnchorEl, newAssemblyName } = this.state
    const { classes, model } = this.props
    const rootModel = getRoot(model)
    return (
      <div className={classes.root}>
        <div className={classes.header}>
          <Typography variant="subtitle1" className={classes.headerText}>
            Configured assemblies
          </Typography>
          <IconButton onClick={this.handleHelpClick}>
            <Icon>help</Icon>
          </IconButton>
          <Popper
            className={classes.popper}
            anchorEl={helpMenuAnchorEl}
            open={Boolean(helpMenuAnchorEl)}
            transition
          >
            {({ TransitionProps }) => (
              <Grow {...TransitionProps} in={Boolean(helpMenuAnchorEl)}>
                <Paper className={classes.menu}>
                  <ClickAwayListener onClickAway={this.handleHelpClose}>
                    <div>
                      <Typography paragraph>
                        JBrowse uses the assemblies listed here to help make
                        sure that tracks appear on the correct reference
                        sequence.
                      </Typography>
                      <Typography paragraph>
                        You can define aliases for an assembly so that the two
                        assembly names are treated as the same, e.g. GRCh37 and
                        hg19.
                      </Typography>
                      <Typography paragraph>
                        You can also define any reference sequences within that
                        assembly that may have multiple names, such as 1 and
                        chr1 or ctgA and contigA.
                      </Typography>
                    </div>
                  </ClickAwayListener>
                </Paper>
              </Grow>
            )}
          </Popper>
        </div>
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
        <Popper
          className={classes.popper}
          anchorEl={addMenuAnchorEl}
          open={Boolean(addMenuAnchorEl)}
          transition
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps} in={Boolean(addMenuAnchorEl)}>
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
                        onClick={this.handleAddAssembly}
                        disabled={!newAssemblyName}
                      >
                        Add assembly
                      </Button>
                    </div>
                  </div>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </div>
    )
  }
}

export default withStyles(styles)(observer(AssemblyEditorDrawerWidget))
