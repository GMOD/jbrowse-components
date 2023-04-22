import React from 'react'
import { getUriLink } from '../../util'
import { SanitizedHTML } from '../../ui'

export default function UriLink({
  value,
}: {
  value: { uri: string; baseUri?: string }
}) {
  const href = getUriLink(value)
  return <SanitizedHTML html={`<a href="${href}">${href}</a>`} />
}
