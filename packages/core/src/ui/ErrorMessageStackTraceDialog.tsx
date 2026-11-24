import { observer } from 'mobx-react'

import CopyToClipboardButton from './CopyToClipboardButton.tsx'
import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import InfoDialog from './InfoDialog.tsx'
import LoadingEllipses from './LoadingEllipses.tsx'
import { useErrorReportText } from './useErrorReportText.ts'

const ErrorMessageStackTraceDialog = observer(
  function ErrorMessageStackTraceDialog({
    error,
    onClose,
    extra,
  }: {
    onClose: () => void
    error: unknown
    extra?: unknown
  }) {
    const { text, isLoading } = useErrorReportText({ error })
    return (
      <InfoDialog
        open
        onClose={() => {
          onClose()
        }}
        maxWidth="xl"
        title="Stack trace"
        actions={
          <CopyToClipboardButton
            variant="contained"
            color="secondary"
            value={text}
            copiedLabel="Copied!"
          >
            Copy stack trace to clipboard
          </CopyToClipboardButton>
        }
      >
        {isLoading ? (
          <LoadingEllipses variant="h6" />
        ) : (
          <ErrorMessageStackTraceContents text={text} extra={extra} />
        )}
      </InfoDialog>
    )
  },
)

export default ErrorMessageStackTraceDialog
