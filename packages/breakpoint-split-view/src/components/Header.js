import clsx from 'clsx'

export default ({ jbrequire }) => {
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = React
  const ReactPropTypes = jbrequire('prop-types')
  const { Icon, IconButton, TextField, Typography, Menu, MenuItem } = jbrequire(
    '@material-ui/core',
  )
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')
  const { assembleLocString, parseLocString } = jbrequire(
    '@gmod/jbrowse-core/util',
  )

  const useStyles = makeStyles(theme => ({
    headerBar: {
      gridArea: '1/1/auto/span 2',
      display: 'flex',
      background: '#eee',
    },
    spacer: {
      flexGrow: 1,
    },
    emphasis: {
      background: '#dddd',
      padding: theme.spacing(1),
    },
    hovered: {
      border: '1px solid grey',
    },
  }))

  const LongMenu = observer(props => {
    const { model, className } = props

    const [anchorEl, setAnchorEl] = React.useState(null)
    const open = Boolean(anchorEl)

    function handleClick(event) {
      setAnchorEl(event.currentTarget)
    }

    function handleClose() {
      setAnchorEl(null)
    }

    return (
      <>
        <IconButton
          aria-label="more"
          aria-controls="long-menu"
          aria-haspopup="true"
          className={className}
          onClick={handleClick}
        >
          <Icon>more_vert</Icon>
        </IconButton>
        <Menu
          id="long-menu"
          anchorEl={anchorEl}
          keepMounted
          open={open}
          onClose={handleClose}
        >
          {model.menuOptions.map(option => (
            <MenuItem
              key={option.key}
              onClick={() => {
                option.callback()
                handleClose()
              }}
            >
              {option.title}
            </MenuItem>
          ))}
        </Menu>
      </>
    )
  })

  LongMenu.propTypes = {
    className: ReactPropTypes.string,
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  const Controls = observer(({ model }) => {
    const classes = useStyles()
    return (
      <>
        <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title="close this view"
        >
          <Icon fontSize="small">close</Icon>
        </IconButton>
        <LongMenu model={model} />
      </>
    )
  })

  Controls.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  function TextFieldOrTypography({ model }) {
    const classes = useStyles()
    const [name, setName] = useState(
      model.displayName || model.displayRegionsFromAssemblyName,
    )
    const [edit, setEdit] = useState(false)
    const [hover, setHover] = useState(false)
    return edit ? (
      <form
        onSubmit={event => {
          setEdit(false)
          model.setDisplayName(name)
          event.preventDefault()
        }}
      >
        <TextField
          value={name}
          onChange={event => {
            setName(event.target.value)
          }}
          onBlur={() => {
            setEdit(false)
            model.setDisplayName(name)
          }}
        />
      </form>
    ) : (
      <div className={clsx(classes.emphasis, hover ? classes.hovered : null)}>
        <Typography
          className={classes.viewName}
          onClick={() => setEdit(true)}
          onMouseOver={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {name}
        </Typography>
      </div>
    )
  }
  TextFieldOrTypography.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  const Header = observer(({ model }) => {
    const classes = useStyles()
    const [error, setError] = useState()
    const navTo = locstring => {
      if (!model.navTo(parseLocString(locstring))) {
        setError(`Unable to find ${locstring}`)
      }
    }
    return (
      <div className={classes.headerBar}>
        {model.hideControls ? null : <Controls model={model} />}
        <TextFieldOrTypography model={model} />
        <div className={classes.spacer} />

        <div className={classes.spacer} />
      </div>
    )
  })

  Header.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return Header
}
