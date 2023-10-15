import { configure as configureReact } from '@testing-library/react'
import { configure as configureDom } from '@testing-library/dom'

configureReact({ asyncUtilTimeout: 10000 })
configureDom({ asyncUtilTimeout: 10000 })
