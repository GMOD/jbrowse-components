import ErrorBar from './ErrorBar.tsx'

export default function ErrorOverlay({
  error,
  onRetry,
  width,
  height,
}: {
  error: unknown
  onRetry: () => void
  width: number | string
  height: number | string
}) {
  return (
    <div style={{ position: 'relative', width, height }}>
      <ErrorBar error={error} onRetry={onRetry} />
    </div>
  )
}
