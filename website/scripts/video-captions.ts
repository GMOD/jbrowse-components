// The caption track a tour ships beside its mp4.
//
// Every step that names itself already writes a line into the frame (`say`, and
// video-overlay.ts draws it). That line is burned into the pixels, which makes
// it unreadable to a screen reader, unfindable by search, and untranslatable.
// The same strings, timed, are a WebVTT file — so the route a tour takes is text
// on the page as well as motion in it, and remark-video hands it to the <video>
// as a real caption track.
//
// THE TIMELINE IS THE CLIP'S, NOT THE RUN'S. A tour is filmed as one webm per
// on-camera stretch and stitched at encode time, so wall-clock elapsed and clip
// elapsed diverge by every second the camera spent off — which on a tour with a
// subgraph cut in it is most of the run. Cues are therefore recorded against
// accumulated ON-CAMERA time, and then scaled once to the finished clip's own
// duration, which is the only number that is not an estimate.
import { writeFileSync } from 'node:fs'

export interface Cue {
  // ms of on-camera time when the line went up, and when it came down
  startMs: number
  endMs: number
  text: string
}

// Collects the lines a tour says, against a clock the caller keeps: `elapsed`
// is on-camera ms, which only the camera can answer for.
export function captionTrack() {
  const cues: Cue[] = []
  let open: { startMs: number; text: string } | undefined
  const close = (at: number) => {
    if (open && at > open.startMs) {
      cues.push({ startMs: open.startMs, endMs: at, text: open.text })
    }
    open = undefined
  }
  return {
    cues,
    // A step's line replaces whatever was showing, so the previous cue ends
    // here. An empty line is the chip fading out, which ends the last cue and
    // starts nothing — the same thing setCaption does to the overlay.
    say(text: string, elapsed: number) {
      close(elapsed)
      if (text) {
        open = { startMs: elapsed, text }
      }
    },
    end(elapsed: number) {
      close(elapsed)
      return cues
    },
  }
}

// `01:02.500`, which is what WebVTT wants and what `Date` will not produce for
// a duration.
function stamp(ms: number) {
  const clamped = Math.max(0, ms)
  const mm = Math.floor(clamped / 60000)
  const ss = Math.floor((clamped % 60000) / 1000)
  const mmm = Math.round(clamped % 1000)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`
}

// Write the cues out, stretched onto the finished clip.
//
// `scale` is the clip's real duration over the on-camera time the run counted.
// It is never far from 1, and it is applied rather than assumed away because
// the two clocks measure different things: the run counts the wall time each
// recorder was open, and the clip is however many frames Chrome actually
// handed over in that time. Without it a 40s tour's last line drifts off the
// end of a 38s clip, and a caption that runs past the video is one that never
// appears.
export function writeVtt(file: string, cues: readonly Cue[], scale: number) {
  const body = cues
    .map(
      (cue, i) =>
        `${i + 1}\n${stamp(cue.startMs * scale)} --> ${stamp(cue.endMs * scale)}\n${cue.text}`,
    )
    .join('\n\n')
  writeFileSync(file, `WEBVTT\n\n${body}\n`)
  return file
}
