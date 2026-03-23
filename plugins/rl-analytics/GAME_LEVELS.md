# JBrowse Navigator: Extended Level & Award Design

Supplement to GAME_DESIGN.md. Covers deeper feature instrumentation, advanced view types, menu exploration mechanics, and visual feedback "dream" features.

---

## Design Principle: Menu Exploration as Gameplay

Players who click around menus and experiment should be rewarded, not just players who follow instructions. The game should feel like exploring a building with many rooms — every door you open reveals something, and the game notices.

The award system is the primary mechanic for this. Awards are retroactive (you don't need a task telling you to open a menu — the game watches silently and applauds when you discover things). The quest system only needs to nudge players toward unexplored territory when they get stuck.

---

## Expanded Award Catalog

### Navigation Awards

| Award | Trigger | Visual | Flavor Text |
|-------|---------|--------|-------------|
| **First Steps** | First PAN in any direction | Footprint icon pulse | "You moved!" |
| **Eagle Eye** | bpPerPx < 0.1 | Magnifying glass glow | "Base-pair resolution. You can see the code of life." |
| **Satellite View** | bpPerPx > 50 (full contig overview) | Globe icon | "The big picture." |
| **Cartographer** | Visit both ctgA and ctgB | Map icon | "You've mapped the territory." |
| **Wayfinder** | Complete any nav task without SEARCH | Compass icon | "No search bar needed." |
| **Rubberband** | First rubberband zoom selection | Rubber band snap animation | "Precision zoom. Elegant." |
| **Bookmark Keeper** | Add first bookmark | Bookmark icon | "Saved for later." |
| **Time Traveler** | First use of undo/redo | Clock icon | "Mistakes happen. You recovered." |

### Track & Display Awards

| Award | Trigger | Visual | Flavor Text |
|-------|---------|--------|-------------|
| **Curator** | Open first track | Layer icon | "There's always more data." |
| **Collector** | Have 3+ tracks open simultaneously | Stack icon | "Multi-dimensional thinking." |
| **Archivist** | Have 5+ tracks open simultaneously | Library icon | "Serious analysis." |
| **Colorist** | Change a track's color scheme (e.g. color by strand) | Palette icon | "Seeing things differently." |
| **Architect** | Change display mode (normal/compact/collapse) | Layout icon | "You customized the view." |
| **Sorter** | Sort alignments by any field | Sort icon | "Order from chaos." |
| **Mismatch Hunter** | Toggle mismatch display or soft-clip visibility | Crosshair icon | "Looking for differences." |
| **Coverage Analyst** | Open an SNPCoverage display | Chart icon | "Quantitative thinking." |

### View Awards

| Award | Trigger | Visual | Flavor Text |
|-------|---------|--------|-------------|
| **Dotplot Pioneer** | Open a Dotplot view | Grid icon | "A new perspective on similarity." |
| **Circle of Life** | Open a Circular view | Circle icon | "Genomes are (sometimes) circular." |
| **Synteny Seeker** | Open a Linear Synteny view | Compare icon | "Comparing genomes side by side." |
| **Spreadsheet Scholar** | Open a Spreadsheet view | Table icon | "Sometimes a table tells you more." |
| **SV Detective** | Open the SV Inspector | Detective icon | "Structural variants — the big mutations." |
| **Split Screen** | Have 2+ views open simultaneously | Split icon | "Divide and conquer." |

### Feature Interaction Awards

| Award | Trigger | Visual | Flavor Text |
|-------|---------|--------|-------------|
| **Inspector** | Click a feature to open its detail widget | Magnifier icon | "Curious minds investigate." |
| **Sequence Reader** | Use "Get sequence" on a region | DNA icon | "ATCG — the language of life." |
| **Copy That** | Copy coordinates or feature info to clipboard | Clipboard icon | "Good lab notebook practice." |
| **Deep Diver** | Hover on a feature for >2 seconds, then click it | Deep sea icon | "Patience reveals detail." |
| **Variant Caller** | Click a variant feature and read its detail widget | Variant icon | "Is this mutation significant?" |

### Menu Exploration Awards

| Award | Trigger | Visual | Flavor Text |
|-------|---------|--------|-------------|
| **Menu Explorer** | Open 3 different menus (File, Add, Tools, any track menu) | Menu icon | "Menus contain power." |
| **Configurer** | Change any display config option (via track menu) | Gear icon | "You're customizing the experience." |
| **Center Line** | Toggle the center line on | Center icon | "A reference point." |
| **Flipper** | Use "Horizontally flip" on a view | Flip icon | "Everything's reversed." |
| **SVG Exporter** | Export view as SVG | Download icon | "Publication-quality figure." |
| **Theme Park** | If available: change theme or any visual preference | Paint icon | "Making it your own." |

### Mastery Awards (Tier 3+)

| Award | Trigger | Visual | Flavor Text |
|-------|---------|--------|-------------|
| **Biologist** | Free-text answer with 2+ genomics keywords | Microscope icon | "You speak the language." |
| **Strand Aware** | Correctly identify strand direction | Helix icon | "Forward or reverse — you know." |
| **Pattern Finder** | Identify a feature by visual scanning (no search) | Eye icon | "Trained eyes." |
| **Cross-Referrer** | Use info from one track to answer a question about another | Link icon | "Connecting the dots." |
| **Speed Run (legit)** | Complete Tier 2 in under 3 minutes without search | Lightning icon | "Fast AND thorough." |

---

## Extended Levels

### Level Pack: "The Toolkit" (post-Tier 1, pre-Tier 2)

These levels exist to get players exploring menus before the biology gets harder. Each level rewards a single menu/config discovery. The quest panel shows a gentle nudge, but the award fires even if the player stumbles onto the feature before the quest mentions it.

**L-TK1: "Right-Click Everything"**
- Quest text: "Features have secrets. Try right-clicking on one."
- Fires when: Player opens a feature context menu (any track).
- Award: Inspector (if they click through to detail widget).
- Instrumentation: `CONTEXT_MENU_OPEN` action type, records target feature type.

**L-TK2: "Change the View"**
- Quest text: "Tracks can look different. Find a track's menu (the three dots or hamburger icon) and look for display options."
- Fires when: Player changes any display setting (color scheme, display mode, etc.).
- Award: Configurer.
- Instrumentation: `DISPLAY_CONFIG_CHANGE` action type, records setting name and old/new value.

**L-TK3: "The Zoom Box"**
- Quest text: "For precise zooming, try clicking and dragging across a region in the overview bar at the top."
- Fires when: Player uses rubberband zoom or overview bar click.
- Award: Rubberband.
- Instrumentation: `RUBBERBAND_ZOOM` action type, records start/end bp.

**L-TK4: "Save Your Place"**
- Quest text: "Found something interesting? Bookmark it. Look in the Tools menu."
- Fires when: Player adds a bookmark.
- Award: Bookmark Keeper.
- Instrumentation: `ADD_BOOKMARK` action type, records region.

**L-TK5: "Oops, Go Back"**
- Quest text: "Made a wrong turn? Try Ctrl+Z (undo)."
- Fires when: Player uses undo or redo.
- Award: Time Traveler.
- Instrumentation: `UNDO` / `REDO` action type.

### Level Pack: "New Perspectives" (between Tier 2 and Tier 3)

These levels introduce non-linear views. Each one opens a new view type and asks a simple question about it.

**L-NP1: "The Dotplot"**
- Quest text: "Open a dotplot view (Add menu → Dotplot view). Load both volvox assemblies. Where the dots form a diagonal line, the sequences match."
- Task: Open a dotplot view with volvox and volvox2. Answer: "Is the match diagonal mostly straight, or does it have breaks?"
- Answer: Multiple choice [Mostly straight / Has breaks / No clear pattern]
- Award: Dotplot Pioneer.
- Instrumentation: `OPEN_VIEW` with viewType='DotplotView'.

**L-NP2: "The Circle"**
- Quest text: "Genomes are often represented as circles. Open a circular view and load volvox."
- Task: Open circular view. "Approximately what fraction of ctgA is covered by gene features — a quarter, half, three-quarters?"
- Award: Circle of Life.
- Instrumentation: `OPEN_VIEW` with viewType='CircularView'.

**L-NP3: "Side by Side"**
- Quest text: "Compare two regions at once. Open a second linear genome view from the Add menu."
- Task: Open two LGV views. Navigate one to ctgA start, the other to ctgA end.
- Validation: Two LGV views exist, their displayed regions don't fully overlap.
- Award: Split Screen.
- Instrumentation: `ADD_VIEW` + count of active views.

### Level Pack: "The Lab" (Tier 3 expansion)

Real analysis tasks using advanced features.

**L-LAB1: "Color by Strand"**
- Quest text: "Alignments can reveal strand bias. Open an alignments track and color the reads by strand. Do you see a pattern?"
- Task: Color reads by strand. Answer: "Are most reads in this region forward-strand (blue), reverse-strand (red), or mixed?"
- Award: Colorist + Strand Aware (if correct).
- Instrumentation: `DISPLAY_CONFIG_CHANGE` with setting='colorScheme', value='strand'.

**L-LAB2: "Compact Mode"**
- Quest text: "Too many reads cluttering the view? Try switching to compact display mode."
- Task: Switch an alignment display to compact mode. Answer: "Can you now see more of the genome at once?"
- Award: Architect.
- Instrumentation: `DISPLAY_CONFIG_CHANGE` with setting='displayMode', value='compact'.

**L-LAB3: "The Mismatch"**
- Quest text: "Mismatches between reads and the reference can indicate variants. Enable mismatch highlighting in the alignments track menu."
- Task: Toggle mismatch visibility. Navigate to a region with mismatches. Answer: "At approximately what position do you see a cluster of mismatches?"
- Award: Mismatch Hunter.
- Instrumentation: `DISPLAY_CONFIG_CHANGE` with setting='showMismatches'.

**L-LAB4: "Get the Sequence"**
- Quest text: "Select a region with rubberband zoom. From the popup menu, choose 'Get sequence'. What are the first 5 bases?"
- Task: Use rubberband → Get sequence. Paste first 5 bases.
- Award: Sequence Reader.
- Instrumentation: `GET_SEQUENCE` action type, records region.

**L-LAB5: "Export Your View"**
- Quest text: "Your view is publication-worthy. Export it as SVG from the view menu."
- Task: Export SVG.
- Award: SVG Exporter.
- Instrumentation: `EXPORT_SVG` action type.

### Level Pack: "Variant Analysis" (Tier 3, biology-heavy)

**L-VA1: "SNP or Indel?"**
- Quest text: "Open the VCF track. Find a variant near position 10,000. Is it a SNP (single base change) or an indel (insertion/deletion)?"
- Requires: VCF track open. Click on variant, read feature widget.
- Award: Variant Caller.

**L-VA2: "Triage by Impact"**
- Quest text: "Not all variants are equal. Find a variant that overlaps a gene exon. Is it more likely to affect the protein than one in an intron?"
- Requires: Gene track + VCF track. Cross-reference positions.
- Award: Cross-Referrer.

**L-VA3: "The Deletion"**
- Quest text: "Look at the structural variant track. Find a deletion — it'll show as a gap in coverage or a special variant symbol. Approximately how many bases were deleted?"
- Requires: SV track or filtered VCF. Visual interpretation.
- Award: SV Detective (if they open SV Inspector to examine further).

---

## New Action Types to Instrument

```typescript
enum ActionType {
  // Existing
  ZOOM_IN, ZOOM_OUT, PAN_LEFT, PAN_RIGHT, SEARCH,
  TOGGLE_TRACK, OPEN_WIDGET, CLOSE_WIDGET, SELECT_FEATURE, ADD_VIEW, UNKNOWN,

  // Navigation
  RUBBERBAND_ZOOM = 'RUBBERBAND_ZOOM',     // rubberband selection → zoom
  OVERVIEW_CLICK = 'OVERVIEW_CLICK',        // click on overview/minimap bar
  RUBBERBAND_SELECT = 'RUBBERBAND_SELECT',  // rubberband without zoom (get sequence, etc.)
  ADD_BOOKMARK = 'ADD_BOOKMARK',            // bookmark a region
  UNDO = 'UNDO',                            // undo action
  REDO = 'REDO',                            // redo action
  CHANGE_REFNAME = 'CHANGE_REFNAME',        // switch contig via dropdown

  // Display configuration
  DISPLAY_CONFIG_CHANGE = 'DISPLAY_CONFIG_CHANGE', // any display setting change
  TRACK_MENU_OPEN = 'TRACK_MENU_OPEN',             // opened a track's config menu
  CONTEXT_MENU_OPEN = 'CONTEXT_MENU_OPEN',          // right-clicked on a feature

  // Feature interaction
  CLICK_FEATURE = 'CLICK_FEATURE',          // click on a specific feature
  HOVER_FEATURE = 'HOVER_FEATURE',          // sustained hover (>500ms)
  GET_SEQUENCE = 'GET_SEQUENCE',            // used "Get sequence" function
  COPY_INFO = 'COPY_INFO',                 // copied coordinates/info to clipboard

  // View management
  OPEN_VIEW = 'OPEN_VIEW',                 // opened a new view (dotplot, circular, etc.)
  CLOSE_VIEW = 'CLOSE_VIEW',               // closed a view
  FLIP_VIEW = 'FLIP_VIEW',                 // horizontally flipped
  TOGGLE_CENTER_LINE = 'TOGGLE_CENTER_LINE', // toggled center line
  TOGGLE_SHOW_LABELS = 'TOGGLE_SHOW_LABELS', // changed track label mode
  EXPORT_SVG = 'EXPORT_SVG',               // exported SVG

  // Alignment-specific
  SORT_ALIGNMENTS = 'SORT_ALIGNMENTS',     // sorted reads by field
  COLOR_BY_CHANGE = 'COLOR_BY_CHANGE',     // changed color-by setting
  DISPLAY_MODE_CHANGE = 'DISPLAY_MODE_CHANGE', // normal/compact/collapse
}
```

### Classifier Rules for New Actions

Patch path patterns to add to ActionClassifier:

```
/views/\d+/displayName          → CHANGE_REFNAME (if refName changed)
/views/\d+/hideHeader           → DISPLAY_CONFIG_CHANGE
/views/\d+/showCenterLine       → TOGGLE_CENTER_LINE
/views/\d+/trackLabels          → TOGGLE_SHOW_LABELS
/session/widgets/.+             → more specific widget type detection
/views/\d+/tracks/\d+/displays/\d+/configuration/.+  → DISPLAY_CONFIG_CHANGE
```

For events that don't produce MST patches (right-click, hover, rubberband), use extension points or DOM listeners registered in `configure()`.

---

## Visual Feedback: "Dream" Features

These are UX enhancements that go beyond what JBrowse currently offers. Some are achievable via the plugin's DOM manipulation; others are aspirational.

### Achievable Now (via plugin DOM manipulation)

**Pulsing Highlight Ring**
When a quest references a specific UI element (e.g., "the track selector button"), render a CSS-animated pulsing ring around it. Implementation: `document.querySelector('[data-testid="..."]')` + inject a positioned `<div>` with CSS animation.

```css
@keyframes quest-pulse {
  0% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.5); }
  70% { box-shadow: 0 0 0 12px rgba(25, 118, 210, 0); }
  100% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0); }
}
.quest-highlight {
  animation: quest-pulse 2s infinite;
  border-radius: 4px;
  pointer-events: none;
  position: absolute;
  z-index: 10000;
}
```

**Floating Arrow**
A small SVG arrow that points at the relevant UI element, animated with a gentle bob. Rendered as a portal outside the widget, positioned relative to the target element. Dismissed when the player interacts with the target.

**Award Burst**
When an award is earned, a brief particle-like burst of small dots radiates from the award chip in the widget. CSS-only (no canvas needed): 6-8 absolutely-positioned `<div>`s with `@keyframes` that translate outward and fade.

**Quest Beacon**
If the player hasn't interacted with the quest's target mechanic after 30 seconds, a subtle animated indicator appears at the edge of the genome view pointing toward where the action should happen. Like a GPS "recalculating" nudge, not a full-screen instruction.

### Achievable with Minor JBrowse Extension

**Track Glow on First Open**
When a player opens a track for the first time, the track header briefly glows with a subtle gold border. Achieved by adding a CSS class to the track DOM element via `MutationObserver` watching for new track elements.

**Viewport Target Overlay**
For navigation tasks with a target region, render a semi-transparent colored band on the overview bar showing where the target is. This gives the player a "compass heading" without giving exact coordinates. Rendered via a positioned `<div>` overlay on the overview bar.

**Zoom Level Indicator**
A small HUD element in the corner of the genome view showing the current "semantic zoom level" as a label: "Overview", "Region", "Gene", "Exon", "Sequence". Helps players understand what zoom level the task expects.

```
bpPerPx > 100   → "Genome"
bpPerPx > 10    → "Region"
bpPerPx > 1     → "Gene"
bpPerPx > 0.1   → "Exon"
bpPerPx ≤ 0.1   → "Sequence"
```

**Progress Trail**
A faint line on the overview bar showing where the player has "been" during the session — regions visited are subtly highlighted. Builds up over time. Gives a sense of coverage and exploration. Similar to fog-of-war clearing in strategy games.

### Aspirational (would need JBrowse core changes)

**Minimap Quest Marker**
A small quest icon (star or diamond) on the overview bar at the target location. Players learn to look at the overview bar for quest hints. Would need the overview bar to accept overlay elements from plugins.

**Feature Spotlight**
When a task references a specific feature, that feature renders with a subtle glow or different outline weight, drawing the eye without being a full highlight. Would need the rendering pipeline to accept per-feature style overrides from plugins.

**Smooth Animated Navigation**
When the game needs to show the player where something is (e.g., after a timeout), animate the viewport smoothly to the target region instead of jumping. JBrowse currently jumps; smooth scroll would need `requestAnimationFrame`-based interpolation of `offsetPx` and `bpPerPx`.

**Achievement Gallery**
A dedicated view (opened from Tools menu) showing all awards as a grid of cards — earned ones are illuminated, unearned ones are silhouetted with "???" names. Encourages completionist behavior. Standard game design but would need a new widget type.

---

## Instrumentation Architecture

### Current: MST Patch Only
The existing system intercepts `onPatch(session, ...)` and classifies patches by path pattern. This captures state mutations but misses DOM-level interactions (hover, right-click, rubberband).

### Extended: MST Patch + DOM Events + Extension Points

```
┌──────────────────────────────────────────┐
│              JBrowse 2 Runtime            │
│                                           │
│  MST State Tree ──onPatch──> PatchListener│
│       │                          │        │
│  DOM Events ───MutationObs──> DOMTracker  │
│       │                          │        │
│  Extension Points ──hook──> ExtPointHook  │
│                                  │        │
│                        ┌─────────▼──────┐ │
│                        │ ActionClassifier│ │
│                        │  (unified)      │ │
│                        └─────────┬──────┘ │
│                                  │        │
│                        ┌─────────▼──────┐ │
│                        │  ActionBuffer   │ │
│                        │  (debounced)    │ │
│                        └─────────┬──────┘ │
│                                  │        │
│          ┌───────────────────────┼────┐   │
│          ▼                       ▼    ▼   │
│    EpisodeManager        AwardManager     │
│          │                       │        │
│          ▼                       ▼        │
│     ExportManager          UI Feedback    │
│    (JSONL/webhook)     (Snackbar/Chips)   │
└──────────────────────────────────────────┘
```

### DOMTracker (new module)

Attaches to the JBrowse DOM after render to capture:
- Hover events (mouseover/mouseout with 500ms debounce)
- Right-click / context menu opens
- Rubberband drag start/end
- Overview bar clicks
- Keyboard shortcuts (Ctrl+Z for undo, etc.)

Registered in `configure()` via `document.addEventListener` with delegation on the JBrowse container element. Produces synthetic `ClassifiedAction` objects that flow into the same `ActionBuffer`.

### Extension Point Hooks (new module)

JBrowse extension points that can intercept actions:
- `Core-extendSession`: watch for session.addWidget calls (widget opens)
- `LinearGenomeView-menu`: watch for menu item clicks
- Track-level extension points for display config changes

These fire synchronously and produce `ClassifiedAction` objects.

---

## Reward Shaping Updates

### Search Penalty (per-task configurable)

```typescript
if (task.searchPenalty !== undefined && episode.metadata.searchUsed) {
  reward *= task.searchPenalty  // e.g., 0.5 = half reward
}
```

### Action Diversity Bonus

```typescript
const uniqueActionTypes = new Set(episode.steps.map(s => s.action)).size
if (uniqueActionTypes >= 5) {
  reward += 1.0  // diverse exploration bonus
}
```

### Award Bonus

```typescript
for (const awardId of awardsEarnedThisStep) {
  reward += 2.0  // substantial bonus for organic discovery
}
```

### Manual Navigation Bonus

```typescript
// For navigate tasks: bonus inversely proportional to search usage
const searchCount = episode.steps.filter(s => s.action === 'SEARCH').length
const totalActions = episode.steps.length
const manualRatio = 1 - (searchCount / totalActions)
reward += manualRatio * 3.0  // up to +3 for fully manual navigation
```

---

## Sample Session Flow (Ideal Player)

```
00:00  [Page loads. ctgA displayed. Reference sequence track visible.]
       Widget shows: "Use your scroll wheel on the genome view."
       Pulsing highlight on genome view area.

00:05  Player scrolls to zoom in.
       ✨ Award: "First Steps" appears briefly.
       Quest advances: "Click and drag to slide left or right."
       Floating arrow points at genome view.

00:12  Player click-drags to pan right.
       Quest advances: "Zoom in until you can read letters..."
       Floating arrow dismissed.

00:25  Player zooms to base resolution.
       ✨ Award: "Eagle Eye" — "Base-pair resolution. The code of life."
       Quest: "What's the first letter on your screen?"
       Player types "A". Correct!

00:45  Quest: "Open a track. Look for the button at the bottom..."
       Pulsing highlight on track selector button.
       Player clicks track selector, finds GFF3 genes, enables it.
       ✨ Award: "Curator" — "There's always more data."

01:10  Quest: "Pan along ctgA. Find a feature. Tell us its name."
       Player pans right, reading labels... finds "EDEN".
       Types "EDEN". Correct!
       ✨ Award: "Explorer" (first significant pan)

01:40  Quest: "Right-click on EDEN."
       Player right-clicks → context menu appears → clicks "Open feature details"
       ✨ Award: "Inspector" — "Curious minds investigate."

02:00  [Gate check: Explorer ✓, Eagle Eye ✓, Curator ✓ → Tier 2 unlocked]
       Quest: "Gene Anatomy: Find EDEN's exons..."
       ... continues ...

05:00  [Tier 2 complete. Player has earned Wayfinder, Colorist.]
       [Tier 3 unlocked. Biology tasks begin.]

12:00  [Tier 3 complete. Player has earned Biologist, Mismatch Hunter.]
       [Tier 4 unlocked: free exploration.]

18:00  Graduation. Completion code displayed.
       "Your exploration data will help train navigation agents.
        You're in the priority pool for future rounds."
```
