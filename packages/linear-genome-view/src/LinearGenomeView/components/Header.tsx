import { IRegion } from '@gmod/jbrowse-core/mst-types'
import Checkbox from '@material-ui/core/Checkbox'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputBase from '@material-ui/core/InputBase'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useState } from 'react'
import { LinearGenomeViewStateModel, HEADER_BAR_HEIGHT } from '..'
import buttonStyles from './buttonStyles'
import RefNameAutocomplete from './RefNameAutocomplete'
import ZoomControls from './ZoomControls'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
    background: '#F2F2F2',
    borderTop: '1px solid #9D9D9D',
    borderBottom: '1px solid #9D9D9D',
  },
  spacer: {
    flexGrow: 1,
  },
  emphasis: {
    background: theme.palette.secondary.main,
    padding: theme.spacing(1),
  },
  searchRoot: {
    margin: theme.spacing(1),
    alignItems: 'center',
  },
  viewName: {
    margin: theme.spacing(0.25),
  },
  hovered: {
    background: theme.palette.secondary.light,
  },
  input: {
    width: 300,
    error: {
      backgroundColor: 'red',
    },
    padding: theme.spacing(0, 1),
  },
  headerRefName: {
    minWidth: 140,
    margin: theme.spacing(0.5),
    background: theme.palette.background.default,
  },
  ...buttonStyles(theme),
}))

const LongMenu = observer(
  ({ model, className }: { model: LGV; className: string }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const open = Boolean(anchorEl)

    function handleClick(event: React.MouseEvent<HTMLElement>) {
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
          color="secondary"
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
          {model.menuOptions.map(option => {
            return option.isCheckbox ? (
              <MenuItem key={option.key}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={option.checked}
                      onChange={() => {
                        option.callback()
                        handleClose()
                      }}
                    />
                  }
                  label={option.title}
                />
              </MenuItem>
            ) : (
              <MenuItem
                key={option.key}
                onClick={() => {
                  option.callback()
                  handleClose()
                }}
              >
                {option.title}
              </MenuItem>
            )
          })}
        </Menu>
      </>
    )
  },
)

const Controls = observer(({ model }) => {
  const classes = useStyles()
  return (
    <>
      <IconButton
        onClick={model.closeView}
        className={classes.iconButton}
        title="close this view"
        color="secondary"
      >
        <Icon fontSize="small">close</Icon>
      </IconButton>

      <IconButton
        onClick={model.activateTrackSelector}
        title="select tracks"
        value="track_select"
        color="secondary"
      >
        <Icon fontSize="small">line_style</Icon>
      </IconButton>
      <LongMenu className={classes.iconButton} model={model} />
    </>
  )
})

const TextFieldOrTypography = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const name = model.displayName
  const [edit, setEdit] = useState(false)
  const [hover, setHover] = useState(false)
  return edit ? (
    <form
      onSubmit={event => {
        setEdit(false)
        event.preventDefault()
      }}
    >
      <TextField
        value={name}
        onChange={event => {
          model.setDisplayName(event.target.value)
        }}
        onBlur={() => {
          setEdit(false)
          model.setDisplayName(name || '')
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
        style={{ color: '#FFFFFF' }}
      >
        {name}
      </Typography>
    </div>
  )
})

function Search({
  onSubmit,
  error,
}: {
  onSubmit: Function
  error: string | undefined
}) {
  const [value, setValue] = useState<string | undefined>()
  const classes = useStyles()
  const placeholder = 'Enter location (e.g. chr1:1000..5000)'

  return (
    <Paper className={classes.searchRoot}>
      <form
        onSubmit={event => {
          onSubmit(value)
          event.preventDefault()
        }}
      >
        <InputBase
          className={classes.input}
          error={!!error}
          onChange={event => setValue(event.target.value)}
          placeholder={placeholder}
        />
        <IconButton
          onClick={() => onSubmit(value)}
          className={classes.iconButton}
          aria-label="search"
          color="secondary"
        >
          <Icon>search</Icon>
        </IconButton>
      </form>
    </Paper>
  )
}
Search.propTypes = {
  onSubmit: ReactPropTypes.func.isRequired,
  error: ReactPropTypes.string, // eslint-disable-line react/require-default-props
}

export default observer(({ model }: { model: LGV }) => {
  const classes = useStyles()

  function setDisplayedRegions(region: IRegion | undefined) {
    if (region) {
      model.setDisplayedRegions([region])
    }
  }

  return (
    <div className={classes.headerBar}>
      <Controls model={model} />
      <TextFieldOrTypography model={model} />
      <div className={classes.spacer} />

      <Search onSubmit={model.navToLocstring} error={''} />
      <RefNameAutocomplete
        model={model}
        onSelect={setDisplayedRegions}
        assemblyName={model.displayedRegions[0].assemblyName}
        defaultRegionName={model.displayedRegions[0].refName}
        TextFieldProps={{
          variant: 'outlined',
          margin: 'none',
          className: classes.headerRefName,
          InputProps: {
            style: {
              paddingTop: 2,
              paddingBottom: 2,
            },
          },
        }}
      />

      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
})
