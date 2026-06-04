import { Link } from '@mui/material'

/** A Link that acts as a button — no real navigation, just calls onClick. */
export default function ActionLink({
  onClick,
  children,
  className,
  title,
}: {
  onClick: () => void
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <Link
      href="#"
      className={className}
      title={title}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </Link>
  )
}
