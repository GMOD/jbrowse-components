import { CODE_TIMEOUT_DEFAULT_MS, CODE_TIMEOUT_MAX_MS } from './budgets.ts'

// The MCP tool surface, defined once for the stdio server (tools/list) and the
// bridge (routing). Import-free of electron and of the renderer, like
// channelTypes.ts, so all three processes can agree on it.
//
// Deliberately four tools. run_javascript is the interface; the other three
// exist only because JavaScript in the renderer cannot express them: pixels
// live in the main process (screenshot), a broken or absent session needs a
// recovery path outside itself (open), and documentation must be readable
// with the app closed (docs). Every correctness rule lives in the `jb` helper
// library instead of in tool plumbing.

// What a client shows the model, and the sources (kept current in
// ../mcp/README.md, "What each client shows the model"):
// - Claude Code cuts the server instructions and each tool description at
//   2048 characters, appending "… [truncated]". Changelog 2.1.84:
//   https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md ("MCP
//   tool descriptions and server instructions are now capped at 2KB");
//   reproduced on 2.1.266 with `pnpm check-mcp-text-caps --probe`.
// - Claude Desktop never shows the model the instructions at all:
//   https://github.com/anthropics/claude-ai-mcp/issues/93.
// So every copy the agent reads before any doc stays under the cap with the
// must-read sentence first, and the stdio server repeats the instructions in
// a session's first run_javascript result. scripts/check-mcp-text-caps.ts
// enforces the cap; the sizes drifted to 2.7 KB and 5 KB before it existed.
export const CLIENT_TEXT_CAP_CHARS = 2048

// Claude Desktop keeps one server process across many chats. The server
// cannot see chat boundaries, so a pause this long since the previous tool
// call is read as a new one, and the next run_javascript result carries the
// instructions again.
export const SESSION_GAP_MS = 15 * 60_000

// Clients whose `initialize` request names them as one that puts the server
// instructions in the model's context, so the repeat in the first
// run_javascript result would be a second copy of the same 1.8 KB. Claude Code
// 2.1.272 sends clientInfo.name "claude-code"; an unknown or absent name keeps
// the repeat, which is the safe default.
export const CLIENTS_SHOWING_INSTRUCTIONS = new Set(['claude-code'])

export function clientShowsInstructions(params: Record<string, unknown>) {
  const name = (params.clientInfo as { name?: unknown } | undefined)?.name
  return typeof name === 'string' && CLIENTS_SHOWING_INSTRUCTIONS.has(name)
}

export const GUIDANCE_PREFIX =
  'Guidance from the jbrowse server (repeated here because some clients do not show the server instructions):'

// Sent in the initialize response; see CLIENT_TEXT_CAP_CHARS.
export const SERVER_INSTRUCTIONS = `JBrowse Desktop genome browser control. One interface: run_javascript runs your code against the live session, with the helper library "jb" passed in as an argument (not a global). open, screenshot and docs cover what code cannot.

FIRST call docs topic "live-model": short — every jb member, what a call answers with, and a contents of the deep dives. "recipes" has a verified snippet for most asks, and "hosted-data" the config URL for any UCSC or GenArk assembly when nothing is open. Orient with jb.sessionSummary(); never assume state carried between calls.

Build with a spec: genomes, tracks, views and layout go on screen in one jb.loadSessionSpec(spec) call. Then change what is open as a document: jb.setSession(edited snapshot) patches views by id, jb.addView(spec) adds one, jb.fitToWindow() makes it all fit. Verify with the settle plus jb.sessionSummary() where that answers, and data with jb.getFeatures; the screenshot tool's description says when an image is worth the bytes, and READ one you take.

Introspect, never guess: jb.listTracks() for trackIds; jb.describeSlots(jb.trackModel('x').activeDisplay.configuration) for a display's settings keys. Every result carries "logs" (console output) and "notifications" (toasts since your previous call). Settle results (jb.waitReady, jb.addTrack, jb.loadSessionSpec) add "notReady" (views that failed to initialize, tracks whose display is not drawing or drew around the config problems its "notices" name; these raise no toast and look fine in a screenshot) and "offscreen" (session taller than the window: screenshot with fullPage: true). A thrown error names the line in your code.

Traps: mutate the model only via actions. Write display settings with track.applyDisplaySettings(settings), never raw assignment; an unknown key lands in its "unapplied" list, so read the report. jb.getFeatures handles refNames a file spells differently. Read a fresh view's region with await jb.visibleRegions(viewId).`

export interface McpToolDefinition {
  name: string
  // 'stdio' is answered inside the stdio server itself, without the app
  handledBy: 'main' | 'renderer' | 'stdio'
  description: string
  inputSchema: Record<string, unknown>
  // What a client needs to decide how much to ask the user before running this.
  // Not capped like the description is: a client reads them, it does not show
  // them to the model.
  annotations: {
    title: string
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
    openWorldHint: boolean
  }
}

export const MCP_TOOLS = [
  {
    name: 'run_javascript',
    handledBy: 'renderer',
    description: `Run an async JavaScript function body in JBrowse Desktop against the LIVE session. READ docs topic "live-model" BEFORE your first call: the contract, every jb member. Arguments: "jb" (the helper library, preferred to the raw model), "session" (the live mobx-state-tree session; re-read each call, a new config replaces it), "rootModel", "pluginManager", "signal" (aborts at timeoutMs; check in long loops). Mutate only through actions.

jb: orient with jb.sessionSummary() (views, tracks, assemblies, regions); jb.inspect(node?) answers a live node's getters, actions and modelType. Tracks: jb.listTracks(search?, limit?) answers { total, tracks }; jb.trackModel(trackId, viewId?) is a shown track's live model; jb.describeSlots(conf) lists a display's settings keys; track.applyDisplaySettings(settings) answers { applied, unapplied, failed }; jb.addTrack({ location | trackId, index?, assembly?, name?, settings?, show?, viewId?, settleMs? }) adds a path or URL, or shows a catalog trackId. Views: jb.loadSessionSpec(spec, settleMs?) builds them, replacing the session; jb.addView(oneViewSpec) adds one beside what is open; jb.setSession(document) rewrites the session as an edited jb.mst.getSnapshot(session), a view keeping its id patched in place; jb.fitToWindow() shrinks it all to fit; jb.view(viewId?); await jb.visibleRegions(viewId?). Data: jb.getFeatures({ trackId, loc?, assembly?, viewId?, regions?, byteLimit? }) gives live Feature objects (visible region by default); aggregate in code, return the answer. Act on a view: await view.navToLocString('BRCA1'|'chr1:1-1000') — a gene name also SHOWS the track whose index answered, unless 4th arg { showHitTrack: false }; await view.launchTrack(trackId, {}, settings); view.hideTrack(trackId). Wait: await jb.waitReady(ms) after mutations. Several views open: helpers throw naming the candidates, so pass viewId.

What you "return" comes back with "logs" (console output), "notifications" (toasts) and "pageErrors"; a throw names the line in YOUR code. State persists on globalThis.`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'Async function body. Use "return" for the value you want back; "await" is available.',
        },
        maxBytes: {
          type: 'number',
          description:
            'Largest serialized result to return whole before truncating to a preview (default 50000)',
        },
        timeoutMs: {
          type: 'number',
          description: `Ms the code may run before the call answers with an error and its console output so far; the code keeps running in the app with its "signal" aborted (default ${CODE_TIMEOUT_DEFAULT_MS}, max ${CODE_TIMEOUT_MAX_MS}). A long job should be started, parked on globalThis and awaited from a later call instead.`,
        },
      },
      required: ['code'],
    },
    annotations: {
      title: 'Run JavaScript in JBrowse Desktop',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: 'docs',
    handledBy: 'stdio',
    description:
      'Read the JBrowse automation documentation, generated from the running version. Pass search to look inside every page at once when you do not know the topic or type name ("color", "modifications", "pif") — it answers with the topic and section to read next, ranked type name first. Topics: "live-model" (driving the live session from run_javascript — read this before your first call), "recipes" (worked snippets for the common asks — tabulating what is on screen, a derived track, a figure per locus, adding a remote file — each verified against the app), "hosted-data" (the ready-made config URL for any UCSC or GenArk assembly, for "show me BRCA1 in human" with nothing open), "session-spec" (the session spec / URL params reference, every view type and launch key), "automating" (overview), "model:<Name>" (one model type\'s runtime API — every action with its signature, getters, properties; the type name is jb.inspect(node).modelType, e.g. model:LinearAlignmentsDisplay), "config:<Name>" (one type\'s config slots, e.g. config:BamAdapter), "types" (every documented type name by category). A long topic answers with what the page is, then its sections and their sizes; pass section for one part — a heading ("Actions"), or a member name ("setColor") for that member\'s line alone, which is the route when you already have the name and the section holding it is 40 KB. "all" reads the whole page. Works while the app is closed.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        section: {
          type: 'string',
          description:
            'A heading of the topic to read (e.g. "Linear genome view"), a member name on a type page (e.g. "setColor") for its line alone, or "all" for the entire document',
        },
        search: {
          type: 'string',
          description:
            'Text to find across every bundled page, when you do not know which topic holds it. Answers with matching topic/section pairs to read, not the pages themselves.',
        },
      },
    },
    annotations: {
      title: 'Read the JBrowse automation docs',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      // bundled at build time and answered without the app, let alone a network
      openWorldHint: false,
    },
  },
  {
    name: 'open',
    handledBy: 'main',
    description:
      'Open a JBrowse config in JBrowse Desktop, replacing the open session; returns once the new session is up (or says so if it is still loading). Takes a local config.json or .jbrowse session file, the URL of a hosted config.json (jbrowse.org/ucsc/<db>/config.json and the rest of genomes.jbrowse.org), or a JBrowse Web URL carrying a session spec or an &assembly=/&loc= shorthand. The recovery path when no session is open or the current one is broken — it works where run_javascript cannot. With NO target, lists the recently opened sessions instead; any listed path can then be opened.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'Absolute path to a .json config or .jbrowse session file, the http(s) URL of a hosted config.json, or a JBrowse Web URL. Omit to list recent sessions.',
        },
      },
    },
    annotations: {
      title: 'Open a config or session',
      readOnlyHint: false,
      // it replaces whatever session is open
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: 'screenshot',
    handledBy: 'main',
    description:
      'Screenshot the JBrowse Desktop window after waiting for tracks to finish loading and drawing. The text part of the result carries the session\'s notifications since your previous call, any tracks that settled without drawing, "pageErrors" (uncaught throws, rejections and dead mobx reactions, which raise no toast), "offscreen" when the session is taller than the window (a viewport capture cuts those views off), and the pixel size of the image; the image is the second part. Use it for a VISUAL change (styling, layout, a figure) and whenever a settle reports notReady or offscreen; for show/hide/reorder/navigate/fit the settle plus jb.sessionSummary() is the verification and far cheaper, and data is jb.getFeatures rather than the picture. Then actually read both. fullPage: true captures the whole laid-out document instead of the viewport, which is the answer to "offscreen". To look closely at one view or track, crop: selector takes a CSS selector (a view is [data-testid="view-container-<view.id>"]; view ids come from jb.sessionSummary()), or rect takes page coordinates in CSS pixels. The image is one pixel per CSS pixel whatever the display\'s density; raise scale to read fine print.',
    inputSchema: {
      type: 'object',
      properties: {
        timeoutMs: {
          type: 'number',
          description:
            'Max ms to wait for rendering to settle before capturing anyway (default 30000, capped at 120000)',
        },
        scale: {
          type: 'number',
          description:
            'Image pixels per CSS pixel (default 1, max 4). 2 doubles the detail and roughly quadruples the bytes; below 1 shrinks a full-page capture of a tall session.',
        },
        fullPage: {
          type: 'boolean',
          description:
            "Capture the whole document rather than the window's viewport, so a session taller than the window comes back in one image (default false)",
        },
        selector: {
          type: 'string',
          description:
            'Crop to the first element matching this CSS selector, e.g. [data-testid="view-container-<view.id>"]',
        },
        rect: {
          type: 'object',
          description:
            'Crop to this box in CSS pixels of the page: { x, y, width, height } (as getBoundingClientRect reports)',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
    },
    annotations: {
      title: 'Screenshot JBrowse Desktop',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
] as const satisfies readonly McpToolDefinition[]

type Tool = (typeof MCP_TOOLS)[number]

/**
 * The tools each process owes a handler, derived from `handledBy` rather than
 * agreed with it. The bridge annotates its routing table with these, so a tool
 * declared here and served nowhere fails the build instead of answering
 * "Unknown tool" to a client that tools/list had just advertised it to.
 */
export type MainToolName = Extract<Tool, { handledBy: 'main' }>['name']
export type RendererToolName = Extract<Tool, { handledBy: 'renderer' }>['name']
