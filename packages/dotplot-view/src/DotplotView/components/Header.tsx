import clsx from 'clsx'
import { withSize } from 'react-sizeme'
import { DotplotViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({ jbrequire }: { jbrequire: any }) => {
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = React
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const Typography = jbrequire('@material-ui/core/Typography')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useStyles = makeStyles((theme: any) => ({
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
          <IconButton
            onClick={model.activateTrackSelector}
            title="select tracks"
            value="track_select"
            color="secondary"
          >
            <Icon fontSize="small">line_style</Icon>
          </IconButton>
          <div className={classes.spacer} />
        </div>
      )
    },
  )

  Header.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return withSize({ monitorHeight: true })(Header)
}
