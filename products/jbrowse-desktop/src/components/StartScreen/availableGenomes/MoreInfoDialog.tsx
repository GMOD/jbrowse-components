import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, Link, Typography } from '@mui/material'

export default function MoreInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog maxWidth="md" onClose={onClose} title="More info" open>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Typography>
            These JBrowse instances leverage UCSC genome browser data resources,
            utilizing both their main data browsers and GenArk track hubs.
          </Typography>
          <Typography>
            JBrowse sends a huge thank you to the UCSC genome browser team for
            their data curation, sharing, and innovation!
          </Typography>
          <Typography>
            Please visit these links for more info, and consider citing UCSC
            alongside JBrowse in your work.
          </Typography>
        </div>

        <ul>
          <li>
            <Link href="https://genome.ucsc.edu/">
              UCSC genome browser home
            </Link>
          </li>
          <li>
            <Link href="https://hgdownload.soe.ucsc.edu/hubs/">
              UCSC GenArk home
            </Link>
          </li>
          <li>
            <Link href="https://genome.ucsc.edu/conditions.html">
              UCSC data re-use policy
            </Link>
          </li>
          <li>
            <Link href="https://github.com/cmdcolin/jb2hubs">
              Our pipeline to import and convert UCSC resources
            </Link>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
