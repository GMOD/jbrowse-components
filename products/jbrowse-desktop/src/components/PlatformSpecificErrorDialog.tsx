import { FatalErrorDialog } from '@jbrowse/core/ui'

import factoryReset from './factoryReset.ts'

export default function PlatformSpecificErrorDialog(props: {
  error?: unknown
}) {
  return <FatalErrorDialog {...props} onFactoryReset={factoryReset} />
}
