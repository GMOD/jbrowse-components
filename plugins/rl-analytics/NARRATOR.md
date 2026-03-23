# Scavenger Hunt Narrator: Design Brief

## Guiding Principles (read this first)

1. **The game watches you. You don't report to it.** Goals are validated automatically and continuously. There is no "Check" button. When the player achieves what the narrator asked for, the narrator notices immediately and responds. The player never has to interrupt their flow to click a validation button.

2. **Everything is an award.** Every meaningful interaction, discovery, and mistake is acknowledged. Awards are the narrator's vocabulary. Positive awards reveal encouragement; negative awards reveal wit and patience. The award system IS the feedback system.

3. **The narrator has a personality.** An enthusiastic, patient, philosophical scientific coach. Think: a brilliant postdoc who genuinely loves this stuff and wants you to love it too. Never condescending. Finds your mistakes interesting rather than disappointing. Gets excited when you discover something. Has a dry sense of humor about the bureaucratic absurdity of the situation. Occasionally philosophical about the nature of genomes and information.

4. **The narrator is a character, not a UI.** It gets lonely if you ignore it. It has opinions. It notices things. It drifts notifications into your peripheral vision when you haven't interacted with the quest panel in a while. It is not a clipboard of tasks — it is a companion.

5. **Fog of war on disallowed/undiscovered affordances.** Semi-opaque overlays on UI elements that aren't yet unlocked or relevant. Red-tinted for blocked, dim for undiscovered. When an element becomes relevant, the fog lifts with a subtle animation. This is cheap to implement (CSS overlays) and communicates state powerfully.

6. **Glowing controls and timed nudges.** If the player hasn't interacted with a relevant control after N seconds, it starts glowing. If they still haven't after 2N seconds, the narrator floats a comment. These are CSS animations and timed callbacks — lightweight, not JS-heavy.

7. **All text assets are centralized and localizable.** Every string the narrator speaks lives in a single locale file, keyed by ID. The narrator module imports from this file. This enables: (a) easy personality tuning, (b) localization to other languages, (c) A/B testing of narrator voice.

8. **Fictional color, lightly applied.** The scenario has a faint sci-fi frame. Maybe this genome is from an uncharted organism. Maybe the analysis matters for reasons not yet fully disclosed. The narrator hints at stakes without over-committing to a plot. Keep it abstract enough to swap out, but vivid enough to create atmosphere.

---

## Narrator Personality Profile

**Name:** (unnamed — they're "the narrator" or "your guide")

**Voice:** Warm, direct, occasionally wry. Uses short sentences. Avoids jargon until the player has demonstrated they know it, then uses it freely and respectfully. Never uses exclamation marks more than once in a row. Gets genuinely curious about what the player finds.

**When the player succeeds:** Brief, specific praise. Not "Great job!" but "Three exons. Exactly right. EDEN is a well-studied gene in this organism." — connects the achievement to real knowledge.

**When the player struggles:** Patient redirection, never repeating the same hint. "The scroll wheel changes your magnification. The click-drag moves you sideways. Different tools for different jobs." Progresses from abstract to concrete.

**When the player is idle:** Playful, escalating. First: nothing (respect their pace). After 30s: a subtle pulse on the relevant control. After 60s: a drifting notification — "Still here. Take your time." After 90s: "The genome isn't going anywhere, but I confess I'm curious what you'll find." After 120s: "I've been thinking about the structure of this region while you were away. Shall we look together?"

**When the player makes a negative discovery (oscillation, confusion):** Reframes it positively. "Interesting — you're exploring the same region from different angles. Sometimes that's how you notice things. But if you're looking for [X], it might be [direction]."

**On awards:** Awards are the narrator's primary speech acts. Each award has a "narrator line" that's in-character. These are not generic "Achievement Unlocked!" — they're the narrator commenting on what just happened.

---

## Text Asset Structure

All narrator text lives in `src/ScavengerHunt/locale/en.ts` (or `.json`). Structure:

```typescript
export default {
  // Award narrator lines
  'award.first_steps.earned': "You moved! The genome stretches out in both directions. What's out there?",
  'award.eagle_eye.earned': "Individual nucleotides. Four letters, three billion positions. You're reading the source code of a living thing.",
  'award.curator.earned': "A new layer of data, revealed. Every track tells part of the story.",
  'award.collector.earned': "Three tracks at once. You're building a richer picture.",
  'award.cartographer.earned': "Two contigs explored. You've seen the whole territory.",
  'award.biologist.earned': "You're using the language. Exons, introns, variants — this is how we talk about genomes.",

  // Idle nudges (escalating)
  'idle.30s': null,  // just pulse the relevant control
  'idle.60s': "Still here. No rush.",
  'idle.90s': "The genome is patient. But I admit I'm curious what you'll find next.",
  'idle.120s': "I've been studying this region while you were away. There's something interesting nearby.",

  // Task-specific narrator lines
  'task.t0-zoom.intro': "See that colorful bar? That's a genome. Try scrolling your mouse wheel over it.",
  'task.t0-zoom.success': "Good. You just changed your magnification. Zoom in to see more detail, zoom out to see more context.",
  'task.t0-pan.intro': "Now try clicking and dragging sideways. You're moving along the chromosome.",
  'task.t0-pan.success': "You're navigating. Everything you need is somewhere along this line.",
  'task.t1-basepairs.intro': "Keep zooming in. There are letters hidden in the sequence — the nucleotide bases. Find them.",
  'task.t1-basepairs.success': "A, T, G, C. Adenine, thymine, guanine, cytosine. Every living thing is written in this alphabet.",
  'task.t1-open-track.intro': "There's more data here than what you can see. Open the track selector to reveal hidden layers.",
  'task.t1-open-track.success': "Each track is a different kind of evidence. Genes, variants, alignments — they all tell part of the story.",

  // Validation feedback (replaces "Check" button responses)
  'validate.zoom_more': "Zoom in a bit more. The letters will appear.",
  'validate.pan_needed': "Try clicking and dragging to move along the genome.",
  'validate.track_missing': "Open the track selector and look for the track mentioned in the task.",
  'validate.answer_wrong': "Not quite. Look more carefully.",
  'validate.too_fast': "That was fast. Take a moment to actually look at what's there.",

  // Narrator personality moments
  'narrator.welcome': "Welcome. You're about to explore a genome. I'll be your guide.",
  'narrator.tier_advance': "You're ready for harder questions. The real analysis starts now.",
  'narrator.graduation': "You've demonstrated real skill. Your navigation data will help train the next generation of genome analysis tools.",
  'narrator.lonely': "The quest panel is over here, whenever you're ready.",
  'narrator.very_lonely': "I've been reorganizing my notes. Did you know this genome has {trackCount} available tracks?",

  // Fog of war
  'fog.blocked': "Not yet. Earn {awardName} first.",
  'fog.undiscovered': "There's something here you haven't tried yet.",
}
```

---

## Auto-Validation Architecture

The game watches continuously. No "Check" button. Implementation:

1. **State polling**: A `setInterval` (every 500ms) in the widget checks the current task's validation criteria against live browser state. When valid, the task auto-completes.

2. **Action-triggered validation**: For action-gated tasks, the `pushActionForValidation` callback triggers immediate validation when a required action type arrives.

3. **Answer validation**: For text-input tasks, validation runs on every keystroke (debounced 300ms). When the answer matches, a confirmation appears and the task advances after a 1-second "narrator is thinking" delay.

4. **Visual confirmation**: When auto-validation succeeds, the task card briefly glows green, the narrator line appears, and after 1.5s the next task slides in.

---

## Fog of War Implementation

CSS overlays positioned over JBrowse UI elements:

```css
.fog-blocked {
  position: absolute;
  background: rgba(180, 30, 30, 0.15);
  pointer-events: none;
  z-index: 9999;
  transition: opacity 0.5s;
}

.fog-undiscovered {
  position: absolute;
  background: rgba(100, 100, 100, 0.1);
  pointer-events: none;
  z-index: 9998;
  transition: opacity 0.5s;
}

.fog-lifting {
  opacity: 0;
}
```

Target elements via `data-testid` selectors. The fog manager tracks which elements are fogged and lifts fog when the corresponding award is earned.

---

## Notification Drift

When the narrator wants attention but the player is focused on the genome view, float a small card from the widget panel edge into the viewport. The card:
- Has a soft shadow and rounded corners
- Drifts leftward at ~20px/s
- Fades to 50% opacity over 5 seconds
- Disappears on click or after 10 seconds
- Contains 1-2 lines of narrator text
- Uses the narrator's personality voice

Implementation: a positioned `<div>` with CSS `transition` on `transform` and `opacity`. Created as a React portal attached to the JBrowse root element. No JS animation loops — pure CSS transitions triggered by class changes.
