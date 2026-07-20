import { useMemo } from 'react'

import CloseIcon from '@mui/icons-material/Close'
import {
  DialogTitle,
  Divider,
  IconButton,
  Dialog as MUIDialog,
  ScopedCssBaseline,
  ThemeProvider,
  createTheme,
  useTheme,
} from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import ErrorBanner from './ErrorBanner.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import SanitizedHTML from './SanitizedHTML.tsx'

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

export interface Props extends Omit<DialogProps, 'onClose'> {
  header?: React.ReactNode
  titleNode?: React.ReactNode
  onClose?:
    | {
        bivarianceHack(
          event: object,
          reason: 'backdropClick' | 'escapeKeyDown' | 'closeButtonClick',
        ): void
      }['bivarianceHack']
    | undefined
}

function Dialog(props: Props) {
  const { classes } = useStyles()
  const { titleNode, header, title, ...rest } = props
  const { children, onClose } = rest
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
                  onClose(event, 'closeButtonClick')
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
