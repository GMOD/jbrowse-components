export default function TabPanel(props: {
  children: React.ReactNode
  value: number
  index: number
}) {
  const { children, value, index } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`genome-tabpanel-${index}`}
      aria-labelledby={`genome-tab-${index}`}
    >
      {value === index && <div>{children}</div>}
    </div>
  )
}
