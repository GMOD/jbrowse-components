import { useEffect, useState } from 'react'

import { observer } from 'mobx-react'

import { readConfObject } from '../configuration/index.ts'
import { isUriLocation } from '../util/types/data.ts'
import { LogoFull } from './Logo.tsx'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { FileLocation, UriLocation } from '../util/types/data.ts'

function resolvedUri(location: UriLocation) {
  return location.baseUri
    ? new URL(location.uri, location.baseUri).href
    : location.uri
}

// A URI goes straight to the <img>, which needs no CORS; a local path, a
// blob or a file handle is read into an object URL.
function useLogoSrc(location: FileLocation | undefined) {
  const [objectUrl, setObjectUrl] = useState<string>()
  useEffect(() => {
    if (!location || isUriLocation(location)) {
      return
    }
    let url: string | undefined
    let cancelled = false
    import('../util/io/index.ts')
      .then(({ openLocation }) => openLocation(location).readFile())
      .then(bytes => {
        if (!cancelled) {
          url = URL.createObjectURL(new Blob([bytes]))
          setObjectUrl(url)
        }
      })
      .catch((e: unknown) => {
        console.error(e)
      })
    return () => {
      cancelled = true
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [location])
  return location && isUriLocation(location)
    ? resolvedUri(location)
    : location
      ? objectUrl
      : undefined
}

const Logo = observer(function Logo({
  session,
}: {
  session: { configuration: AnyConfigurationModel }
}) {
  const src = useLogoSrc(readConfObject(session.configuration, 'logoPath'))
  return src ? (
    <img src={src} alt="Custom logo" />
  ) : (
    <LogoFull variant="white" />
  )
})

export default Logo
