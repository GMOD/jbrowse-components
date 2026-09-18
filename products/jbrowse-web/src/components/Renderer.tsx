import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import JBrowse from './JBrowse.tsx'
import Loading from './Loading.tsx'

import type { SessionLoaderModel } from '../SessionLoader.ts'

const SessionTriaged = lazy(() => import('./SessionTriaged.tsx'))
const LoaderErrorBanner = lazy(() => import('./LoaderErrorBanner.tsx'))
const CrashedSessionBanner = lazy(() => import('./CrashedSessionBanner.tsx'))

const Renderer = observer(function Renderer({
  loader,
}: {
  loader: SessionLoaderModel
}) {
  const {
    configError,
    crashedSession,
    pluginManager,
    pluginManagerError,
    sessionTriaged,
  } = loader
  const err = configError || pluginManagerError
  if (err) {
    // `data-app-error` is how @jbrowse/capture tells a failed load from a slow
    // one without waiting out its timeout
    return (
      <>
        <span hidden data-app-error={`${err}`} />
        <Suspense fallback={null}>
          <LoaderErrorBanner error={err} />
        </Suspense>
      </>
    )
  } else if (crashedSession) {
    return (
      <Suspense fallback={null}>
        <CrashedSessionBanner loader={loader} crashedSession={crashedSession} />
      </Suspense>
    )
  } else if (sessionTriaged) {
    return (
      <Suspense fallback={null}>
        <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
      </Suspense>
    )
  } else if (pluginManager) {
    return <JBrowse pluginManager={pluginManager} />
  } else {
    return <Loading />
  }
})

export default Renderer
