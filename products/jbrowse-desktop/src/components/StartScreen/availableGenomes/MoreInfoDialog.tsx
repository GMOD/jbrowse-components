import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, Link, Typography } from '@mui/material'

export default function MoreInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog maxWidth="md" onClose={onClose} title="More info" open>
      <DialogContent>
        <Typography>
          These JBrowse instances leverage UCSC genome browser data resources,
          utilizing both their main data browsers and trackhubs. JBrowse sends a
          huge thank you to the UCSC genome browser team for their data
          curation, data sharing, and technical innovations. Please visit these
          links for more info, and consider citing UCSC alongside JBrowse in
          your work.
        </Typography>
        <ul>
          <li>
            <Link href="https://hgdownload.soe.ucsc.edu/hubs/">
              UCSC GenArk hubs
            </Link>
          </li>
          <li>
            <Link href="https://genome.ucsc.edu/">
              UCSC genome browser home
            </Link>
          </li>
          <li>
            <Link href="https://genome.ucsc.edu/conditions.html">
              UCSC data re-use policy
            </Link>
          </li>
          <li>
            Our pipeline to import and convert UCSC resources:{' '}
            <Link href="https://github.com/cmdcolin/ucsc2jbrowse">
              ucsc2jbrowse
            </Link>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
