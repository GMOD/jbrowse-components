import React from 'react'
import {
  Dialog as MUIDialog,
  DialogTitle,
  DialogProps,
  Divider,
  IconButton,
  ScopedCssBaseline,
  ThemeProvider,
  createTheme,
  useTheme,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { ErrorBoundary } from 'react-error-boundary'

// icons
import CloseIcon from '@mui/icons-material/Close'
// locals
import ErrorMessage from './ErrorMessage'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    color: theme.palette.grey[500],
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
  },
}))

function DialogError({ error }: { error: unknown }) {
  return (
    <div style={{ margin: 40, width: 800 }}>
      <ErrorMessage error={error} />
    </div>
  )
}

interface Props extends DialogProps {
  header?: React.ReactNode
}

const Dialog = observer(function (props: Props) {
  const { classes } = useStyles()
  const { title, header, children, onClose } = props
  const theme = useTheme()

  return (
    <MUIDialog {...props}>
      <ScopedCssBaseline>
        {React.isValidElement(header) ? (
          header
        ) : (
          <DialogTitle>
            {title}
            {onClose ? (
              <IconButton
                className={classes.closeButton}
                onClick={() => {
                  // @ts-expect-error
                  onClose()
                }}
              >
                <CloseIcon />
              </IconButton>
            ) : null}
          </DialogTitle>
        )}
        <Divider />

        <ErrorBoundary FallbackComponent={DialogError}>
          <ThemeProvider
            theme={createTheme(theme, {
              components: {
                MuiInputBase: {
                  styleOverrides: {
                    input: {
                      // xref https://github.com/GMOD/jbrowse-components/pull/3666
                      boxSizing: 'content-box!important' as 'content-box',
                    },
                  },
                },
              },
            })}
          >
            {children}
          </ThemeProvider>
        </ErrorBoundary>
      </ScopedCssBaseline>
    </MUIDialog>
  )
})

export default Dialog
