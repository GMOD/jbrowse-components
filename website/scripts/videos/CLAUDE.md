# website/scripts/videos

Framing, captions and steps: `agent-docs/reference/VIDEO_TOURS.md`.

- **The last repaints of a clip do not reach the file**: make anything the last
  frame needs true well before it.
- **A radio menu item leaves its menu open over its result**; close it with
  `leaveMenu(row)` in `shared.ts`.
- **A display over its density gate still reports `ready`.** Wait on
  `{ type: 'waitForText', text: 'Too many features', hidden: true }`, then on
  the display.
- `cut: true` on a `type` step films a paste.
