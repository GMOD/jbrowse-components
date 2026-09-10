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

export const GUIDANCE_PREFIX =
  'Guidance from the jbrowse server (repeated here because some clients do not show the server instructions):'

// Sent in the initialize response; see CLIENT_TEXT_CAP_CHARS.
export const SERVER_INSTRUCTIONS = `JBrowse Desktop (genome browser) control. One interface: run_javascript runs your code against the live session, with the helper library "jb" passed in as an argument (not a global; jbrowse-web publishes the same object as window.jb). open, screenshot and docs cover what code cannot.

FIRST call docs topic "live-model": short, with working examples and every jb member. Then "recipes" has a verified snippet for most asks, and "hosted-data" the config URL for any UCSC or GenArk assembly when nothing is open. Orient with jb.sessionSummary() and never assume state carried over between calls. After changing anything, screenshot AND read the image: a wrong trackId, empty region or dropped settings key renders as a plausible browser with something quietly missing. Verify data claims with jb.getFeatures, not from the picture.

Introspect, never guess: jb.listTracks() for trackIds; jb.describeSlots(jb.trackModel('x').activeDisplay.configuration) for a display's settings keys. Every result carries "logs" (console output) and "notifications" (toasts since your previous call, with level). Settle results (jb.waitReady, and what jb.addTrack and jb.loadSessionSpec return) add "notReady" (views that failed to initialize, tracks whose display is not drawing; these raise no toast and look fine in a screenshot) and "offscreen" (session taller than the window: screenshot with fullPage: true). A thrown error names the line in your code.

Traps: mutate the model only via actions. Write display settings with track.applyDisplaySettings(settings), never raw assignment; an unknown key lands in its "unapplied" list, so read the report. A track too tall for the window wants heightMode "fit" or "grow", not displayMode "compact". Data files may spell refNames differently than the assembly: jb.getFeatures handles it. A fresh view throws "width undefined" until it mounts: read its region with await jb.visibleRegions(viewId). Aggregate large results in code; never return thousands of raw features.`

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
    description: `Run an async JavaScript function body inside JBrowse Desktop against the LIVE session. READ docs topic "live-model" BEFORE your first call: short, working examples, every jb member. Your code receives these arguments: "jb" (the helper library, the same object jbrowse-web publishes as window.jb; prefer it to the raw model), "session" (the live mobx-state-tree session; re-read it each call, a new config replaces it), "rootModel", "pluginManager", "signal" (aborts at timeoutMs; check it in long loops). This is the whole interface: state, views, data, styling and feature reads are all code. Mutate the model only through actions.

jb in brief. Orient: jb.sessionSummary() first (views, tracks, assemblies, visible regions); jb.inspect(path?) walks the live model by dot-path, listing getters, actions and modelType. Tracks: jb.listTracks(search?, limit?) answers { total, tracks } (trackId, name, type, adapterType, assemblyNames); jb.trackModel(trackId, viewId?) is the shown track's live model; jb.describeSlots(conf) lists every settings key a display accepts; track.applyDisplaySettings(settings) answers { applied, unapplied, failed }; jb.addTrack({ location, index?, assembly?, name?, show?, viewId?, settleMs? }) takes a path or URL. Views: jb.view(viewId?); jb.loadSessionSpec(spec, settleMs?) builds views declaratively (docs topic "session-spec"); view.navToLocString("BRCA1"); await view.launchTrack(id); await jb.visibleRegions(viewId?). Data: jb.getFeatures({ trackId, loc?, assembly?, viewId?, regions?, byteLimit? }) returns live Feature objects (visible region by default); aggregate in code, return only the answer. Wait: await jb.waitReady(ms) after mutations. With several views open, the helpers throw naming the candidates: pass viewId from jb.sessionSummary().

Whatever you "return" comes back serialized (size-capped) with "logs" (console output), "notifications" (toasts) and "pageErrors" (throws no toast carried); a throw names the line in YOUR code. State persists on globalThis.`,
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
      'Read the JBrowse automation documentation, generated from the running version. Pass search to look inside every page at once when you do not know the topic or type name ("colorBy", "modifications", "pif") — it answers with the topic and section to read next, ranked type name first. Topics: "live-model" (driving the live session from run_javascript — read this before your first call), "recipes" (worked snippets for the common asks — tabulating what is on screen, a derived track, a figure per locus, adding a remote file — each verified against the app), "hosted-data" (the ready-made config URL for any UCSC or GenArk assembly, for "show me BRCA1 in human" with nothing open), "session-spec" (the session spec / URL params reference, every view type and launch key), "automating" (overview), "model:<Name>" (one model type\'s runtime API — every action with its signature, getters, properties; the type name is jb.inspect(path).modelType, e.g. model:LinearAlignmentsDisplay), "config:<Name>" (one type\'s config slots, e.g. config:BamAdapter), "types" (every documented type name by category). A long topic answers with its table of contents and section sizes; pass section (a heading, e.g. "Actions") to read one part, or "all". Works while the app is closed.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        section: {
          type: 'string',
          description:
            'A heading of the topic to read (e.g. "Linear genome view"), or "all" for the entire document',
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
      'Screenshot the JBrowse Desktop window after waiting for tracks to finish loading and drawing. The text part of the result carries the session\'s notifications since your previous call, any tracks that settled without drawing, "pageErrors" (uncaught throws, rejections and dead mobx reactions, which raise no toast), "offscreen" when the session is taller than the window (a viewport capture cuts those views off), and the pixel size of the image; the image is the second part. Use it after every change worth verifying — then actually read both. fullPage: true captures the whole laid-out document instead of the viewport, which is the answer to "offscreen". To look closely at one view or track, crop: selector takes a CSS selector (a view is [data-testid="view-container-<view.id>"]; view ids come from jb.sessionSummary()), or rect takes page coordinates in CSS pixels. The image is one pixel per CSS pixel whatever the display\'s density; raise scale to read fine print.',
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
