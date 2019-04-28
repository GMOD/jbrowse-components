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
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import { getRoot, getSnapshot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import { readConfObject } from '@gmod/jbrowse-core/configuration'

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

function AssemblyEditorDrawerWidget(props) {
  const [addMenuAnchorEl, setAddMenuAnchorEl] = useState(null)
  const [helpMenuAnchorEl, setHelpMenuAnchorEl] = useState(null)
  const [newAssemblyName, setNewAssemblyName] = useState('')
  const [assemblies, setAssemblies] = useState(new Map())

  const { classes, model } = props
  const rootModel = getRoot(model)

  function handleHelpClick(event) {
    setHelpMenuAnchorEl(helpMenuAnchorEl ? null : event.currentTarget)
  }

  function handleHelpClose(event) {
    if (helpMenuAnchorEl && helpMenuAnchorEl.contains(event.target)) return
    setHelpMenuAnchorEl(null)
  }

  function handleFabClick(event) {
    setAddMenuAnchorEl(addMenuAnchorEl ? null : event.currentTarget)
  }

  function handleFabClose(event) {
    if (addMenuAnchorEl && addMenuAnchorEl.contains(event.target)) return
    setAddMenuAnchorEl(null)
  }

  function handleNewAssemblyChange(event) {
    setNewAssemblyName(event.target.value)
  }

  function handleAddAssembly(event) {
    setAssemblies(new Map())
    handleFabClose(event)
    rootModel.configuration.addAssembly(newAssemblyName)
    setNewAssemblyName('')
  }

  async function fetchAssemblies(rootAssemblies) {
    const results = []
    for (const [assemblyName, assembly] of rootAssemblies) {
      const { rpcManager } = rootModel
      results.push(
        rpcManager.call(
          assembly.configId,
          'getRefNameAliases',
          {
            sessionId: assemblyName,
            adapterType: readConfObject(assembly, [
              'refNameAliases',
              'adapter',
              'type',
            ]),
            adapterConfig: readConfObject(assembly, [
              'refNameAliases',
              'adapter',
            ]),
          },
          { timeout: 1000000 },
        ),
      )
    }
    const assemblyRefNameAliases = await Promise.all(results)
    const newAssemblies = new Map()
    let idx = 0
    for (const [assemblyName, assembly] of rootAssemblies) {
      newAssemblies.set(assemblyName, [assembly, assemblyRefNameAliases[idx]])
      idx += 1
    }
    setAssemblies(newAssemblies)
  }

  useEffect(
    () => {
      fetchAssemblies(rootModel.configuration.assemblies)
    },
    [getSnapshot(rootModel.configuration.assemblies)],
  )

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography variant="subtitle1" className={classes.headerText}>
          Configured assemblies
        </Typography>
        <IconButton
          onClick={handleHelpClick}
          data-testid="AssemblyEditorDrawerWidgetHelpButton"
        >
          <Icon>help</Icon>
        </IconButton>
        <Popper
          className={classes.popper}
          anchorEl={helpMenuAnchorEl}
          open={Boolean(helpMenuAnchorEl)}
          transition
          data-testid="AssemblyEditorDrawerWidgetHelpPopper"
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps} in={Boolean(helpMenuAnchorEl)}>
              <Paper className={classes.menu}>
                <ClickAwayListener onClickAway={handleHelpClose}>
                  <div>
                    <Typography paragraph>
                      JBrowse uses the assemblies listed here to help make sure
                      that tracks appear on the correct reference sequence.
                    </Typography>
                    <Typography paragraph>
                      You can define aliases for an assembly so that the two
                      assembly names are treated as the same, e.g. GRCh37 and
                      hg19.
                    </Typography>
                    <Typography paragraph>
                      You can also define any reference sequences within that
                      assembly that may have multiple names, such as 1 and chr1
                      or ctgA and contigA.
                    </Typography>
                  </div>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </div>
      {Array.from(assemblies, ([assemblyName, [assembly, refNameAliases]]) => (
        <Card className={classes.assembly} key={assemblyName}>
          <CardHeader
            title={assemblyName}
            action={
              <>
                <IconButton
                  onClick={() =>
                    rootModel.editConfiguration(
                      rootModel.configuration.assemblies.get(assemblyName),
                    )
                  }
                >
                  <Icon>edit</Icon>
                </IconButton>
                <IconButton
                  onClick={() =>
                    rootModel.configuration.removeAssembly(assemblyName)
                  }
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
                {readConfObject(assembly, 'aliases').map((alias, idx) => (
                  <ListItem key={alias}>
                    <ListItemAvatar>
                      <Avatar className={classes.listNumber}>{idx + 1}</Avatar>
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
                {refNameAliases.map(({ refName, aliases }) => (
                  <List
                    key={refName}
                    dense
                    subheader={<ListSubheader>{refName}</ListSubheader>}
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
                ))}
              </List>
            </Paper>
          </CardContent>
        </Card>
      ))}
      <Fab
        color="secondary"
        className={classes.fab}
        onClick={handleFabClick}
        data-testid="AssemblyEditorDrawerWidgetFAB"
      >
        <Icon>add</Icon>
      </Fab>
      <Popper
        className={classes.popper}
        anchorEl={addMenuAnchorEl}
        open={Boolean(addMenuAnchorEl)}
        transition
        data-testid="AssemblyEditorDrawerWidgetAddPopper"
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} in={Boolean(addMenuAnchorEl)}>
            <Paper className={classes.menu}>
              <ClickAwayListener onClickAway={handleFabClose}>
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
                    onChange={handleNewAssemblyChange}
                  />
                  <div className={classes.menuButtons}>
                    <Button color="secondary" onClick={handleFabClose}>
                      Cancel
                    </Button>
                    <Button
                      color="secondary"
                      onClick={handleAddAssembly}
                      disabled={!newAssemblyName}
                      data-testid="AssemblyEditorDrawerWidgetSubmitButton"
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

AssemblyEditorDrawerWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  classes: propTypes.objectOf(propTypes.string).isRequired,
}

export default withStyles(styles)(observer(AssemblyEditorDrawerWidget))
