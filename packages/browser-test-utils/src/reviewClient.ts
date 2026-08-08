// The browser half of a review tool: the write protocol as the page speaks it,
// and the note-draft bookkeeping that keeps a reviewer's words from being eaten
// by a repaint. Its server counterpart is reviewServer.ts, and it is shared for
// the same reason — both review UIs (the website's screenshot review and
// jbrowse-web's browser-test snapshot review) post to the same two endpoints
// under the same two preconditions, and the recovery rules are subtle enough
// (serialize writes per card, adopt what the server reports on a 409, never let
// a failed write look like one that landed, never let a re-render take
// unsaved text) that a second copy of them is a second place for them to drift.
// It already had: the same note-loss bug was fixed in both files in one commit,
// twice.
//
// This is emitted as JavaScript source and spliced into the tool's inline
// <script>, so it shares one flat scope with the page around it. That scope is
// the interface, and it has two halves.
//
// It OWNS, and the page may use:
//   data              the entries being reviewed; the page's load() assigns it
//   justActed         names acted on since the filter view was entered, so a
//                     card stays visible after its verdict stops matching the
//                     filter; clearJustActed() on a filter change
//   $ esc pill        the DOM/HTML helpers every card renderer needs
//   cardOf cardEl     find a card element by name, or from a button inside it
//   setVerdict saveNote clearVerdict addNote   the inline button/field handlers
//   updateCard        re-render one card in place, held until after the click
//                     if a pointer is down (see the comment on it)
//   harvestNotes applyPendingNotes     call around a full #main repaint
//                     (applyPendingNotes also sizes the note fields to their
//                     text, so a page that repaints #main gets that for free)
//   dropStaleDrafts   call once after load(), when data is first populated
//   draftHint pendingNotes setDraft paintDraft   draft state for the renderer
//
// It REQUIRES the page to declare, as function declarations (hoisted, so they
// may appear after this block):
//   renderCard(entry)   the HTML for one card, including a .note field, an
//                       .unsaved flag, a .cardmsg box and data-name on the root
//   renderCounts()      repaint whatever the header counts. No arguments: it is
//                       called after every single-card repaint too, so anything
//                       it counts against it has to read for itself

export interface ReviewClientOptions {
  // localStorage key this tool's note drafts live under. Distinct per tool, or
  // two review UIs open side by side would trade drafts for names that mean
  // different pictures in each.
  draftsKey: string
  // How this tool says an image moved on disk under the reviewer, e.g. 'this
  // figure was regenerated'. Reads mid-sentence in the 409 message.
  imageMovedPhrase: string
}

export function reviewClientScript({
  draftsKey,
  imageMovedPhrase,
}: ReviewClientOptions): string {
  return `
// ---- shared review client (packages/browser-test-utils/src/reviewClient.ts).
// Edit it there, not here: both review UIs are served this same source.

let data = []
// Names acted on since the current filter view was entered. They stay visible
// even once their new verdict no longer matches the filter, so you can still
// type a reason after clicking Deny in the unreviewed/denied queue.
let justActed = new Set()
function clearJustActed() {
  justActed = new Set()
}

const $ = sel => document.querySelector(sel)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pill = (cls, text) => '<span class="pill ' + cls + '">' + text + '</span>'

const cardEl = btn => btn.closest('.card')
const cardOf = name =>
  [...document.querySelectorAll('.card')].find(c => c.dataset.name === name)

const entryOf = name => data.find(s => s.name === name)

// Per-card outcome message: a write that failed, or one rejected because the
// entry moved on disk. Kept outside \\\`data\\\` so a re-render reproduces it.
const cardMessages = new Map()
const messageText = name => (cardMessages.get(name) || {}).text || ''
const msgClass = name =>
  'cardmsg' + (cardMessages.has(name) ? ' ' + cardMessages.get(name).kind : '')

function setMessage(name, text, kind) {
  if (text) {
    cardMessages.set(name, { text, kind })
  } else {
    cardMessages.delete(name)
  }
}

// Update the message in place, for the paths that must not re-render (a note
// field's own save — re-rendering there would put back the stored note and
// throw away what the reviewer just typed).
function paintMessage(name) {
  const el = cardOf(name)
  const box = el && el.querySelector('.cardmsg')
  if (box) {
    box.textContent = messageText(name)
    box.className = msgClass(name)
  }
}

// Note text typed but not yet saved, by entry name. A render rebuilds all of
// #main from \\\`data\\\`, which knows only what the server has — so a note on a card
// with no verdict yet (saveNote has nothing to attach it to) lived only in the
// DOM, and the next repaint threw it away. Typing a reason and then reaching for
// the search box was enough to lose it. Carried across every repaint instead,
// and dropped once what is on the card matches what is saved.
//
// It outlives the page too, in localStorage. A note only reaches the server when
// the field blurs, and on an entry with no verdict it never reaches it at all,
// so a reload — the one thing a reviewer does constantly, since regenerate/
// reload/look again IS the loop — used to throw away whatever had been typed
// since the last click elsewhere. Whether the words survived came down to
// whether the reviewer happened to click away first, which reads as random.
const DRAFTS_KEY = ${JSON.stringify(draftsKey)}

function loadDrafts() {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]')
    return Array.isArray(raw)
      ? raw.filter(e => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string')
      : []
  } catch {
    // unparseable or unavailable: a lost draft is bad, a review tool that will
    // not open is worse
    return []
  }
}

const pendingNotes = new Map(loadDrafts())

// One write per event-loop turn. harvestNotes touches every rendered card and a
// render runs on every search keystroke, so persisting per card would be a few
// hundred synchronous localStorage writes per keypress. A microtask still drains
// before the page could go anywhere, so nothing typed is at risk in the gap.
let draftFlush = null

function saveDrafts() {
  draftFlush ??= Promise.resolve().then(() => {
    draftFlush = null
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify([...pendingNotes]))
    } catch {
      // a full or disabled store is not worth failing the review over
    }
  })
}

const savedNote = name => (entryOf(name)?.verdict?.note) || ''

// Record what is in the box right now. A draft is only a draft while it differs
// from what the report holds, so this doubles as the cleanup: the save paths
// call it with the text they just persisted and it drops itself.
function setDraft(name, typed) {
  if (typed === savedNote(name)) {
    pendingNotes.delete(name)
  } else {
    pendingNotes.set(name, typed)
  }
  saveDrafts()
}

function harvestNotes() {
  for (const el of document.querySelectorAll('.card')) {
    const typed = el.querySelector('.note')?.value
    if (typed !== undefined) {
      setDraft(el.dataset.name, typed)
    }
  }
}

function applyPendingNotes() {
  for (const el of document.querySelectorAll('.card')) {
    const typed = pendingNotes.get(el.dataset.name)
    const note = el.querySelector('.note')
    if (typed !== undefined && note) {
      note.value = typed
    }
  }
  autosizeNotes()
}

// A denial reason is the one field here that runs long — it is a paragraph
// arguing with a picture — and a fixed two-row box showed only the last line of
// what was being typed, with the rest scrolled out of reach of the eye that
// needed to reread it. Grow the box with its text instead, up to a cap past
// which it scrolls: the note sits under the figure it is about, and a box that
// grew without limit would push that figure off the screen.
//
// Guarded on textarea because an <input> has no content height to grow to.
// Both review UIs render a textarea today; the guard is what lets a third
// renderer use an input without this silently pinning it to one scrollHeight.
const NOTE_MAX_PX = 320
function autosizeNote(el) {
  if (!el || el.tagName !== 'TEXTAREA') {
    return
  }
  // shrink first: scrollHeight can never report less than the current height,
  // so without this the box only ever grows, including after a deletion
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, NOTE_MAX_PX) + 'px'
}

function autosizeNotes() {
  for (const el of document.querySelectorAll('.note')) {
    autosizeNote(el)
  }
}

// Drop drafts the report has caught up with, and drafts for entries that no
// longer exist. Without this a note saved in one session comes back as an
// "unsaved" draft in the next, and deleted entries accumulate in the store
// forever. Runs once the page has its data, since both questions need it.
function dropStaleDrafts() {
  for (const [name, typed] of [...pendingNotes]) {
    if (!data.some(s => s.name === name) || typed === savedNote(name)) {
      pendingNotes.delete(name)
    }
  }
  saveDrafts()
}

// Say plainly whether the words in the box are in the report yet. The two ways
// out differ — an entry with a verdict saves on blur, one without cannot save at
// all until there is a verdict to attach to — and guessing which case you are in
// is what makes a note field feel unreliable.
const draftHint = entry =>
  !pendingNotes.has(entry.name)
    ? ''
    : entry.verdict
      ? 'unsaved — click outside the box to save'
      : 'unsaved — approve or deny to save this note'

function paintDraft(name) {
  const el = cardOf(name)
  const flag = el && el.querySelector('.unsaved')
  const entry = entryOf(name)
  if (flag && entry) {
    flag.textContent = draftHint(entry)
  }
}

// What this tab had in hand, sent with every write so the server can reject one
// composed against state that has since moved. null means "there was none",
// which is a precondition worth stating too: it catches a tab that would
// otherwise resurrect an entry another process deleted. The image hash is the
// half that matters most — it is what makes an approval mean "I looked at these
// pixels" rather than "I clicked while these pixels were the current ones".
const precondition = entry => (entry.verdict ? entry.verdict.reviewedAt : null)
const imgPrecondition = entry => entry.imageHash || null

// Never let a write that did not land look like one that did. Throws on
// failure; returns { conflict: true, ... } when the server refused because the
// entry changed underneath us.
async function readWriteResponse(res) {
  const body = await res.json().catch(() => null)
  if (res.status === 409) {
    return {
      conflict: true,
      reason: body ? body.reason : 'verdict',
      current: body && body.current ? body.current : undefined,
      stale: !!(body && body.stale),
      imageHash: body ? body.imageHash : null,
    }
  }
  if (!res.ok) {
    throw new Error((body && body.error) || 'HTTP ' + res.status)
  }
  return { conflict: false, body: body }
}

async function postJson(url, payload) {
  return readWriteResponse(await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

function postVerdict(entry, status, note) {
  return postJson('/api/verdict', {
    name: entry.name,
    status,
    note,
    ifReviewedAt: precondition(entry),
    ifImageHash: imgPrecondition(entry),
  })
}

// Take on what the server says is on disk, so the next write carries a
// precondition that will actually match. Adopting the image hash also swaps the
// <img> URL, so the re-render puts the new picture in front of the reviewer
// instead of leaving the old one cached in place.
function adoptRemote(entry, result) {
  entry.verdict = result.current
  entry.stale = result.stale
  entry.imageHash = result.imageHash
}

const conflictText = result =>
  result.reason === 'image'
    ? 'Not saved — ${imageMovedPhrase} since the page loaded, so the ' +
      'image you just judged is not the one on disk. The new one is above; ' +
      'look again before deciding.'
    : 'Not saved — this entry changed elsewhere since the page loaded (now: ' +
      (result.current ? result.current.status : 'cleared') +
      '). The card is back in sync; act again if you still want to.'

// Writes for one card run one after another. Clicking Approve while the note
// field has focus fires that field's change event first — the blur is part
// of the click — so two writes for the same card are issued back to back.
// Unserialized, the second still carries the reviewedAt the first has already
// replaced, and the server refuses it as a conflict with a change that was us:
// the reviewer's Approve silently does not land and the card says the entry
// moved elsewhere.
const writeChain = new Map()

function queueWrite(name, fn) {
  const run = (writeChain.get(name) || Promise.resolve()).then(fn)
  // each caller reports its own failure; the chain itself must survive one
  writeChain.set(name, run.catch(() => {}))
  return run
}

async function setVerdict(btn, status) {
  const name = cardEl(btn).dataset.name
  const entry = entryOf(name)
  if (!entry) {
    return
  }
  await queueWrite(name, async () => {
    // Read the note now rather than when the button was clicked: a note save
    // ahead of us in the queue may have re-rendered the card. The card can also
    // be gone entirely by now (a filter changed since the click), in which case
    // the last saved note is the best text we have — better than dropping the
    // verdict on the floor.
    const noteEl = cardOf(name)?.querySelector('.note')
    const note = noteEl
      ? noteEl.value
      : pendingNotes.has(name)
        ? pendingNotes.get(name)
        : entry.verdict
          ? entry.verdict.note
          : ''
    try {
      const result = await postVerdict(entry, status, note)
      if (result.conflict) {
        adoptRemote(entry, result)
        setMessage(name, conflictText(result), 'warn')
      } else {
        // adopt the server's own verdict: it carries the reviewedAt the next
        // write has to match and the image hash this tab cannot compute. It was
        // recorded against the current image, so it is not stale.
        entry.verdict = result.body
        entry.stale = false
        setMessage(name, '')
      }
    } catch (err) {
      setMessage(name, 'Not saved — ' + err.message, 'error')
    }
    justActed.add(name)
    updateCard(name)
  })
}

// Persist note edits on their own so a reason typed after Approve/Deny is saved
// without needing to click the button again. Deliberately does not re-render on
// the ordinary path: the reviewer's text stays exactly as they left it.
async function saveNote(input) {
  const name = cardEl(input).dataset.name
  const entry = entryOf(name)
  const note = input.value
  if (!entry) {
    return
  }
  await queueWrite(name, async () => {
    if (!entry.verdict) {
      // a note has nothing to attach to until there is a verdict; say so rather
      // than dropping the words silently, as this used to. An Approve/Deny click
      // is usually right behind us in the queue, and it carries this text along.
      setMessage(name, 'Note not saved yet — approve or deny and it goes with the verdict.', 'warn')
      paintMessage(name)
      return
    }
    // A note save carries the image precondition too, because the server
    // restamps the verdict's hash from the current image on every write: without
    // it, typing a note would quietly re-bless one that had been rewritten
    // since, and clear its 'changed since review' flag with nobody having
    // looked.
    try {
      const result = await postVerdict(entry, entry.verdict.status, note)
      if (result.conflict) {
        adoptRemote(entry, result)
        setMessage(name, conflictText(result) + ' Your note text is still here — blur again to save it.', 'warn')
        // re-render on this path only: it swaps in the image that is actually
        // on disk, and updateCard carries the typed note across for us
        updateCard(name)
        return
      }
      entry.verdict = result.body
      // The server restamps the verdict's hash from the image on disk, so a save
      // against an entry that WAS stale has just made it fresh. Saying otherwise
      // left the card wearing its amber 'image changed since <status>' pill, the
      // header still counting it, and the next repaint putting it back in the
      // needs-review queue — all describing a verdict that no longer exists on
      // disk, until a reload. Repaint from what was written instead; updateCard
      // carries the typed note across for us.
      const wasStale = entry.stale
      entry.stale = false
      setMessage(name, '')
      if (wasStale) {
        updateCard(name)
      }
    } catch (err) {
      setMessage(name, 'Note not saved — ' + err.message, 'error')
    }
    // the draft clears itself once the report holds the same text, and stays put
    // when the write failed — which is the case the reviewer needs it for
    setDraft(name, note)
    paintDraft(name)
    paintMessage(name)
  })
}

// Start a new note without throwing the last one away.
//
// The manual version is retyping "the new thing. previous notes: <the old
// text>" every time, and the friction of that is why the old note usually just
// gets overwritten instead. That loses the wrong thing: a denial reason is the
// record of WHY a figure was rejected, and the second look at a figure is
// exactly when the first look's reasoning is worth having in front of you.
//
// Newest on top, because that is the order the reviewer wrote it in and the
// order a truncated box shows. Repeated adds nest, which is honest: three
// rounds of review read as three entries rather than as one merged paragraph
// nobody can date.
//
// Nothing is written to the server here, and that is deliberate: a bare
// "previous notes:" header with nothing above it is not a note. The field goes
// dirty on the first keystroke and saves on blur like any other edit. What IS
// recorded is the draft, so a reload between clicking this and typing does not
// lose the restructuring.
function addNote(btn) {
  const el = cardEl(btn)
  const note = el && el.querySelector('.note')
  if (!note) {
    return
  }
  const old = note.value.trim()
  note.value = old ? '\\n\\nprevious notes:\\n' + old : ''
  note.focus()
  // caret above the divider, which is the whole point, and scrollTop with it,
  // because a box at its NOTE_MAX_PX cap otherwise opens showing the bottom of
  // the old note rather than the empty line the cursor is on
  note.setSelectionRange(0, 0)
  autosizeNote(note)
  note.scrollTop = 0
  // a programmatic write fires no 'input', so the draft bookkeeping that typing
  // gets for free has to be done by hand
  setDraft(el.dataset.name, note.value)
  paintDraft(el.dataset.name)
}

async function clearVerdict(btn) {
  const name = cardEl(btn).dataset.name
  const entry = entryOf(name)
  if (!entry) {
    return
  }
  await queueWrite(name, async () => {
    try {
      const result = await postJson('/api/verdict/clear', {
        name,
        ifReviewedAt: precondition(entry),
      })
      if (result.conflict) {
        adoptRemote(entry, result)
        setMessage(name, conflictText(result), 'warn')
      } else {
        entry.verdict = undefined
        entry.stale = false
        setMessage(name, '')
      }
    } catch (err) {
      setMessage(name, 'Not cleared — ' + err.message, 'error')
    }
    updateCard(name)
  })
}

// A click is a mousedown and a mouseup on the same element, and the note
// field's change event fires on the mousedown that takes focus out of it — so a
// note save is always in flight during the very click that triggered it, and on
// localhost it lands well inside the ~80ms a real click is held. Swapping the
// card in that window destroys the button the pointer is on, the browser
// dispatches no click at all, and the reviewer's Deny silently does nothing
// until they click again. Typing a note on a stale entry hits this every time:
// that save makes the entry fresh, which is a repaint.
//
// So hold repaints while a pointer is down and run them once the click this
// pointer is about to produce has been dispatched — a timer set during pointerup
// runs after the click, which is dispatched in the same task as the mouseup.
let pointerHeld = false
const deferredCards = new Set()

function flushDeferredCards() {
  const names = [...deferredCards]
  deferredCards.clear()
  for (const name of names) {
    paintCard(name)
  }
}

// capture, so a card's own handlers cannot stop these from being seen. The flush
// on pointerdown is the safety net for a release the page never saw — a mouseup
// outside the window, say — which would otherwise strand a card unpainted.
addEventListener('pointerdown', () => {
  flushDeferredCards()
  pointerHeld = true
}, true)
for (const ev of ['pointerup', 'pointercancel']) {
  addEventListener(ev, () => {
    pointerHeld = false
    setTimeout(flushDeferredCards)
  }, true)
}

function updateCard(name) {
  if (pointerHeld) {
    deferredCards.add(name)
  } else {
    paintCard(name)
  }
}

// Re-render a single card in place rather than rebuilding all of main, so
// acting on one card never wipes unsaved note text typed into other cards.
function paintCard(name) {
  const entry = entryOf(name)
  const el = cardOf(name)
  if (entry && el) {
    // Carry the note field's live value across the swap. On a write that landed
    // this is exactly what was saved anyway; on one that failed or conflicted
    // it is the difference between "try again" and losing the words typed.
    const typed = el.querySelector('.note').value
    // record before the swap so the rebuilt card renders the right draft hint
    setDraft(name, typed)
    el.outerHTML = renderCard(entry)
    const note = cardOf(name).querySelector('.note')
    note.value = typed
    autosizeNote(note)
  }
  renderCounts()
}

// Capture the draft on every keystroke rather than waiting for a repaint to
// harvest it. A reload is not a repaint: it fires no 'change' on the focused
// note field and runs no render, so text typed since the last one had nothing
// holding it anywhere.
$('#main').addEventListener('input', e => {
  const note = e.target.closest('.note')
  if (note) {
    const name = note.closest('.card').dataset.name
    setDraft(name, note.value)
    paintDraft(name)
    autosizeNote(note)
  }
})
// ---- end shared review client
`
}
