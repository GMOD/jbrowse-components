import { Link } from '@mui/material'

/** A Link that acts as a button — no real navigation, just calls onClick. */
export default function ActionLink({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href="#"
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </Link>
  )
}
