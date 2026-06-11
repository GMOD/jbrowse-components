import { useMemo } from 'react'

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
import ErrorBanner from './ErrorBanner.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import SanitizedHTML from './SanitizedHTML.tsx'
import { makeStyles } from '../util/tss-react/index.ts'

import type { DialogProps } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  errorBox: {
    maxWidth: 800,
    margin: theme.spacing(5),
  },
}))

function DialogError({ error }: { error: unknown }) {
  const { classes } = useStyles()
  return (
    <div className={classes.errorBox}>
      <ErrorBanner error={error} />
    </div>
  )
}

export interface Props extends DialogProps {
  header?: React.ReactNode
  titleNode?: React.ReactNode
}

function Dialog(props: Props) {
  const { classes } = useStyles()
  const { titleNode, header, ...rest } = props
  const { title, children, onClose } = rest
  const theme = useTheme()
  // content-box override xref https://github.com/GMOD/jbrowse-components/pull/3666
  const dialogTheme = useMemo(
    () =>
      createTheme(theme, {
        components: {
          MuiInputBase: {
            styleOverrides: {
              input: {
                boxSizing: 'content-box!important' as 'content-box',
              },
            },
          },
        },
      }),
    [theme],
  )

  return (
    <MUIDialog {...rest}>
      <ScopedCssBaseline>
        {header ? (
          header
        ) : (
          <DialogTitle>
            {titleNode ?? <SanitizedHTML html={title ?? ''} />}
            {onClose ? (
              <IconButton
                className={classes.closeButton}
                onClick={event => {
                  onClose(event, 'backdropClick')
                }}
              >
                <CloseIcon />
              </IconButton>
            ) : null}
          </DialogTitle>
        )}
        <Divider />

        <ErrorBoundary FallbackComponent={DialogError}>
          <ThemeProvider theme={dialogTheme}>{children}</ThemeProvider>
        </ErrorBoundary>
      </ScopedCssBaseline>
    </MUIDialog>
  )
}

export default Dialog
