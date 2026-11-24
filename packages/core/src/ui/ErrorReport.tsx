import { observer } from 'mobx-react'

import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import LoadingEllipses from './LoadingEllipses.tsx'
import { useErrorReportText } from './useErrorReportText.ts'

const ErrorReport = observer(function ErrorReport(
  props: Parameters<typeof useErrorReportText>[0],
) {
  const { text, isLoading } = useErrorReportText(props)
  return isLoading ? (
    <LoadingEllipses variant="h6" />
  ) : (
    <ErrorMessageStackTraceContents text={text} />
  )
})

export default ErrorReport
