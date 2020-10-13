import CloseIcon from '@material-ui/icons/Close'
import LineStyleIcon from '@material-ui/icons/LineStyle'
import clsx from 'clsx'
import { withSize } from 'react-sizeme'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import IconButton from '@material-ui/core/IconButton'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { DotplotViewModel } from '../model'

export default () => {
  const useStyles = makeStyles(theme => ({
    headerBar: {
      gridArea: '1/1/auto/span 2',
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
    hovered: {
      background: theme.palette.secondary.light,
    },
  }))

  const Controls = observer(({ model }: { model: DotplotViewModel }) => {
    return (
      <IconButton onClick={model.closeView} title="close this view">
        <CloseIcon />
      </IconButton>
    )
  })

  const TextFieldOrTypography = observer(
    ({ model }: { model: DotplotViewModel }) => {
      const classes = useStyles()
      const [name, setName] = useState(model.displayName)
      const [edit, setEdit] = useState(false)
      const [hover, setHover] = useState(false)
      return edit ? (
        <form
          onSubmit={(event: React.FormEvent) => {
            setEdit(false)
            model.setDisplayName(name)
            event.preventDefault()
          }}
        >
          <TextField
            value={name}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
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
            onClick={() => setEdit(true)}
            onMouseOver={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ color: '#FFFFFF' }}
          >
            {name}
          </Typography>
        </div>
      )
    },
  )

  const Header = observer(
    ({
      model,
      size,
    }: {
      model: DotplotViewModel
      size: { height: number }
    }) => {
      const classes = useStyles()

      model.setHeaderHeight(size.height)
      return (
        <div className={classes.headerBar}>
          <Controls model={model} />
          <TextFieldOrTypography model={model} />

          <IconButton
            onClick={model.activateTrackSelector}
            title="select tracks"
            value="track_select"
            color="secondary"
          >
            <LineStyleIcon />
          </IconButton>
          <div className={classes.spacer} />
        </div>
      )
    },
  )

  return withSize({ monitorHeight: true })(Header)
}
