import { observer } from 'mobx-react'

import { readConfObject } from '../configuration/index.ts'
import { LogoFull } from './Logo.tsx'

import type { AnyConfigurationModel } from '../configuration/index.ts'

const Logo = observer(function Logo({
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
