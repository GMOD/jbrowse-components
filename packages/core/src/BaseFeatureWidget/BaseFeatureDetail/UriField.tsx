import SimpleField from './SimpleField.tsx'

export default function UriField({
  value,
  prefix,
  name,
  width,
}: {
  value: { uri: string; baseUri?: string }
  name: string
  prefix: string[]
  width?: number
}) {
  const { uri, baseUri = '' } = value
  let href: string
  try {
    href = new URL(uri, baseUri).href
  } catch {
    href = uri
  }
  // width forwarded like any other field's: without it a URI row sized its own
  // label to content and sat out of the column every row beside it shares
  return <SimpleField name={name} prefix={prefix} value={href} width={width} />
}
