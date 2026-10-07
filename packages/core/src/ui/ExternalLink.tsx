import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinkProps } from '@mui/material'

const ExternalLink = observer(function ExternalLink(props: LinkProps) {
  const { children, ...rest } = props
  return (
    <Link {...rest} target="_blank" rel="noopener noreferrer">
      {children} <OpenInNewIcon fontSize="small" />
    </Link>
  )
})

export default ExternalLink
