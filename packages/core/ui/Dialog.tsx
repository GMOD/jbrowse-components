import { isValidElement } from 'react'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import CloseIcon from '@mui/icons-material/Close'
import {
  Dialog as MUIDialog,
  DialogTitle,
  Divider,
  IconButton,
  ScopedCssBaseline,
  ThemeProvider,
  createTheme,
  useTheme,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ErrorMessage from './ErrorMessage'
import SanitizedHTML from './SanitizedHTML'

import type { DialogProps } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  errorBox: {
    width: 800,
    margin: 40,
  },
}))

function DialogError({ error }: { error: unknown }) {
  const { classes } = useStyles()
  return (
    <div className={classes.errorBox}>
      <ErrorMessage error={error} />
    </div>
  )
}

interface Props extends DialogProps {
  header?: React.ReactNode
  titleNode?: React.ReactNode
}

const Dialog = observer(function (props: Props) {
  const { classes } = useStyles()
  const { titleNode, ...rest } = props
  const { title, header, children, onClose } = rest
  const theme = useTheme()

  return (
    <MUIDialog {...rest}>
      <ScopedCssBaseline>
        {isValidElement(header) ? (
          header
        ) : (
          <DialogTitle>
            {titleNode || <SanitizedHTML html={title || ''} />}
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
