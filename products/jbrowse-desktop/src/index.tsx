import { setLocalFileFetch } from '@jbrowse/core/util/io'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto'

import { localFileFetch } from './localFileFetch'
import Loader from './components/Loader'
import PlatformSpecificErrorDialog from './components/PlatformSpecificErrorDialog'

// Enable local file access using Node's fs module
setLocalFileFetch(localFileFetch)

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
