import { Typography } from '@mui/material'

const ScoreAxisHelp = (
  <>
    <Typography gutterBottom>
      Each change redraws the track as you make it. An empty Min or Max follows
      the data in view; the value in brackets is where it lands now.
    </Typography>
    <Typography gutterBottom>
      Signed log is like log but keeps 0 and negative values.
    </Typography>
    <Typography gutterBottom>
      Include 0 stretches an axis that follows the data to reach 0. Clip extreme
      outliers stops an end short of a value that would leave the others under
      half the axis, and marks the cut bars in red. Both act only on an end that
      follows the data.
    </Typography>
    <Typography gutterBottom>
      A reference line is drawn at its value on the track's own scale.
    </Typography>
  </>
)

export default ScoreAxisHelp
