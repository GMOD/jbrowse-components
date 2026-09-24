import '@fontsource/roboto'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { createRoot } from 'react-dom/client'

import Loader from './components/Loader.tsx'
import PlatformSpecificErrorDialog from './components/PlatformSpecificErrorDialog.tsx'

setStackTraceLimit()

const root = createRoot(document.getElementById('root')!)

root.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificErrorDialog}>
    <Loader />
  </ErrorBoundary>,
)
