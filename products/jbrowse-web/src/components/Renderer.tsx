import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import JBrowse from './JBrowse.tsx'
import Loading from './Loading.tsx'

import type { SessionLoaderModel } from '../SessionLoader.ts'

const SessionTriaged = lazy(() => import('./SessionTriaged.tsx'))
const LoaderErrorBanner = lazy(() => import('./LoaderErrorBanner.tsx'))

const Renderer = observer(function Renderer({
  loader,
}: {
  loader: SessionLoaderModel
}) {
  const { configError, pluginManager, pluginManagerError, sessionTriaged } =
    loader
  const err = configError || pluginManagerError
  if (err) {
    return (
      <Suspense fallback={null}>
        <LoaderErrorBanner error={err} />
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
