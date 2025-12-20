export default function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  if (!query || !text) {
    return text
  }

  const queryLower = query.toLowerCase().trim()
  const textLower = text.toLowerCase()

  const index = textLower.indexOf(queryLower)
  if (index === -1) {
    return text
  }

  const beforeMatch = text.slice(0, Math.max(0, index))
  const match = text.slice(index, index + query.length)
  const afterMatch = text.slice(Math.max(0, index + query.length))

  return (
    <>
      {beforeMatch}
      <mark style={{ backgroundColor: 'yellow' }}>{match}</mark>
      <HighlightedText text={afterMatch} query={query} />
    </>
  )
}
