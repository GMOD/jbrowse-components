import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Link } from '@mui/material'

import type { LinkProps } from '@mui/material'

export default function ExternalLink(props: LinkProps) {
  const { children, ...rest } = props
  return (
    <Link {...rest} target="_blank" rel="noopener noreferrer">
      {children} <OpenInNewIcon fontSize="small" />
    </Link>
  )
}
