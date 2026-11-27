---
name: connect-an-ai-agent-with-no-window-open-shows-no-dialog
description: On macOS, Help → Connect an AI agent... with no window open opens a window but no dialog, because `connectAgent` only calls `ensureWindow()` and the `connectAgentSetup` message sent right after would be discarded before `ConnectAgentHost` subscribes.
---

# Connect an AI agent with no window open shows no dialog

`connectAgent` in `products/jbrowse-desktop/electron/electron.ts` sends
`connectAgentSetup` only when `wm.current` exists. With none, it calls
`wm.ensureWindow()` and stops. Sending the setup right after the load would not
help: `ConnectAgentHost` subscribes in an effect after the load finishes, so the
message is discarded.

Fix: the main process holds the request, and the host asks for it when it
mounts.
