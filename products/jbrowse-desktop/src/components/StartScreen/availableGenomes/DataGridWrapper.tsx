import { useInnerDims } from './util.ts'

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
        height: innerHeight * (3 / 5),
      }}
    >
      {children}
    </div>
  )
}
