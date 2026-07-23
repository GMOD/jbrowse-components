import '@fontsource/roboto'
import 'dockview-react/dist/styles/dockview.css'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { createRoot } from 'react-dom/client'

import Loader from './components/Loader.tsx'
import PlatformSpecificErrorDialog from './components/PlatformSpecificErrorDialog.tsx'

setStackTraceLimit()

if (window.name.startsWith('JBrowseAuthWindow')) {
  window.opener?.postMessage({
    name: window.name,
    redirectUri: window.location.href,
  })
  window.close()
}

const root = createRoot(document.getElementById('root')!)

root.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificErrorDialog}>
    <Loader />
  </ErrorBoundary>,
)
