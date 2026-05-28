import { Link } from '@mui/material'

/** A Link that acts as a button — no real navigation, just calls onClick. */
export default function ActionLink({
  onClick,
  children,
  className,
}: {
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href="#"
      className={className}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </Link>
  )
}
