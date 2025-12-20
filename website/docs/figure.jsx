import useBaseUrl from '@docusaurus/useBaseUrl'

export default function Figure({ src, caption }) {
  return (
    <figure style={{ border: '1px solid #888', padding: 20 }}>
      <img src={useBaseUrl(src)} alt={caption} />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
