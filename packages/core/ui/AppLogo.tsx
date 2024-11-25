import React from 'react'
import { observer } from 'mobx-react'

// locals
import { readConfObject } from '../configuration'

// ui elements
import { LogoFull } from './Logo'
import type { AnyConfigurationModel } from '../configuration'

const Logo = observer(function ({
  session,
}: {
  session: { configuration: AnyConfigurationModel }
}) {
  const { configuration } = session
  const logoPath = readConfObject(configuration, 'logoPath')
  return logoPath?.uri ? (
    <img src={logoPath.uri} alt="Custom logo" />
  ) : (
    <LogoFull variant="white" />
  )
})

export default Logo
