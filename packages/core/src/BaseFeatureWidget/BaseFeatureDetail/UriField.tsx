import SimpleField from './SimpleField.tsx'

export default function UriField({
  value,
  prefix,
  name,
}: {
  value: { uri: string; baseUri?: string }
  name: string
  prefix: string[]
}) {
  const { uri, baseUri = '' } = value
  let href: string
  try {
    href = new URL(uri, baseUri).href
  } catch (e) {
    href = uri
  }
  return <SimpleField name={name} prefix={prefix} value={href} />
}
