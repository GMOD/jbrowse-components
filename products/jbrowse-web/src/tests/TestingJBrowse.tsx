import { observer } from 'mobx-react'

import JBrowse from '../components/JBrowse.tsx'

const TestingJBrowse = observer(function TestingJBrowse(props: any) {
  return <JBrowse {...props} />
})

export default TestingJBrowse
