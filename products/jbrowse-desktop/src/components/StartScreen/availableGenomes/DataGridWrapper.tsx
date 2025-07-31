import { useInnerDims } from './util'

export default function DataGridWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const { height: innerHeight, width: innerWidth } = useInnerDims()
  return (
    <div
      style={{
        width: innerWidth * (3 / 4),
        height: innerHeight * (1 / 2),
      }}
    >
      {children}
    </div>
  )
}
