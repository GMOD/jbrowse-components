import { Suspense, lazy } from 'react'

import Loading from './components/Loading.tsx'
import { initAuthWindow } from './initAuthWindow.ts'

const Main = lazy(() => import('./components/Loader.tsx'))

initAuthWindow()

const date = Date.now()
export default function InitialLoad() {
  return (
    <Suspense fallback={<Loading />}>
      <Main initialTimestamp={date} />
    </Suspense>
  )
}
