export default function AutoSizer({
  children,
}: {
  children: (size: { height: number; width: number }) => unknown
}) {
  return children({ height: 9000, width: 800 })
}
