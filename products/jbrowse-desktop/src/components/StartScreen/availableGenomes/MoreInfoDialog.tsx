import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, Link, Typography } from '@mui/material'

export default function MoreInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog maxWidth="md" onClose={onClose} title="More info" open>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Typography>
            This resource leverage UCSC genome browser resources. Please
            consider citing UCSC, JBrowse, and any other relevant data in your
            work. See resources below for more information
          </Typography>
        </div>

        <ul>
          <li>
            <Link href="https://genome.ucsc.edu/">
              UCSC genome browser home
            </Link>
          </li>
          <li>
            <Link href="https://genomes.jbrowse.org/about">
              JBrowse 2 genomes about page
            </Link>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
