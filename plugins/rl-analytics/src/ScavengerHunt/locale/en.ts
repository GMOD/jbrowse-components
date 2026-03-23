/**
 * Centralized text assets for the Scavenger Hunt narrator.
 *
 * All player-facing text lives here. This enables:
 * - Personality tuning (edit one file to change the narrator's voice)
 * - Localization (create fr.ts, es.ts, etc. with the same keys)
 * - A/B testing of narrator styles
 *
 * Narrator personality: enthusiastic, patient, philosophical scientific coach.
 * Short sentences. Occasionally wry. Never condescending. Genuinely curious.
 */

const en = {
  // === Awards: earned lines ===
  'award.first_steps.earned':
    "You moved! The genome stretches out in both directions. What's out there?",
  'award.eagle_eye.earned':
    'Individual nucleotides. Four letters encoding a living thing. You\'re reading source code.',
  'award.curator.earned':
    'A new layer of evidence, revealed. Every track tells part of the story.',
  'award.collector.earned':
    'Three tracks at once. You\'re cross-referencing — that\'s how real analysis works.',
  'award.cartographer.earned':
    'Two contigs explored. You\'ve seen the whole territory.',
  'award.biologist.earned':
    'You\'re speaking the language now. Exons, variants, coverage — this is genomics.',
  'award.wayfinder.earned':
    'No search bar. You navigated by eye and hand. That\'s skill.',
  'award.inspector.earned':
    'Curious minds click things. There\'s always more data behind the surface.',
  'award.colorist.earned':
    'Color reveals structure. You\'re seeing the data differently now.',
  'award.rubberband.earned':
    'Precision selection. Elegant.',

  // === Negative/observational awards ===
  'award.oscillator.earned':
    'You\'re going back and forth. Interesting approach — but if you\'re looking for something specific, try a different direction.',
  'award.speed_demon.earned':
    'That was fast. Maybe too fast? The data rewards patience.',
  'award.lost.earned':
    'Feeling turned around? The overview bar at the top shows where you are on the whole chromosome.',

  // === Idle nudges (escalating) ===
  'idle.pulse': '', // no text, just highlight the relevant control
  'idle.30s': '',
  'idle.60s': 'Still here. No rush.',
  'idle.90s':
    "The genome is patient. But I admit I'm curious what you'll find next.",
  'idle.120s':
    "I've been studying this region while you were away. Something caught my eye nearby.",
  'idle.180s':
    'The quest panel is over here, whenever you\'re ready. I\'ve been reorganizing my notes.',

  // === Task intro lines (narrator voice when task begins) ===
  'task.t0-zoom.intro':
    'See that colorful bar? That\'s a genome. Use the + and - buttons in the header to zoom.',
  'task.t0-zoom.success':
    'Good. You changed your magnification. Zoom in for detail, zoom out for context.',
  'task.t0-pan.intro':
    'Now try clicking and dragging sideways. You\'re moving along the chromosome.',
  'task.t0-pan.success':
    "You're navigating. Everything you need is somewhere along this line.",
  'task.t1-basepairs.intro':
    'Keep zooming in. There are letters hidden in the sequence. Find them.',
  'task.t1-basepairs.success':
    'A, T, G, C. Adenine, thymine, guanine, cytosine. Every living thing is written in this alphabet.',
  'task.t1-open-track.intro':
    "There's more data here than what you see. Open the track selector to reveal hidden layers.",
  'task.t1-open-track.success':
    'Each track is a different kind of evidence. Genes, variants, alignments — pieces of the same puzzle.',
  'task.t1-find-feature.intro':
    "Pan along the genome. You'll find annotated features — genes, mostly. Tell me the name of one.",
  'task.t1-find-feature.success':
    "Found one. These annotations are predictions about what the DNA does. Some are well-studied, others are mysteries.",
  'task.t1-other-contig.intro':
    'This genome has two contigs. You\'ve been on ctgA. ctgB is smaller — can you find it?',
  'task.t1-other-contig.success':
    "ctgB. Smaller, but no less interesting. In real genomes, some of the most important genes are on the shortest chromosomes.",
  'task.t2-gene-anatomy.intro':
    'Find the gene EDEN. Zoom in to see its exons — the thick blocks. Count them.',
  'task.t2-gene-anatomy.success':
    "Three exons. The thin lines between them are introns — they're transcribed but spliced out of the mRNA.",
  'task.t2-downstream.intro':
    "Starting at EDEN, pan to the right. What's the next feature you find?",
  'task.t2-downstream.success':
    'Good eye. Genes often cluster in neighborhoods. Whether that clustering means something is one of the big questions.',
  'task.t2-variant-type.intro':
    'Open the variants track and find a variant near position 5,000. Click it. What kind of change is it?',
  'task.t2-variant-type.success':
    'Variants are the raw material of evolution. Each one is a place where this genome differs from the reference.',
  'task.t3-multi-track.intro':
    'Open three or more tracks. Find a region where the data layers tell you something together that no single layer shows alone.',
  'task.t3-multi-track.success':
    'Integration. That\'s what separates looking from analyzing.',
  'task.t3-exploration.intro':
    'Free exploration. Go wherever you want, look at whatever interests you. Report back.',
  'task.t3-exploration.success':
    'Your path through this data is unique. No two people explore a genome the same way.',
  'task.t4-teach.intro':
    'Navigate somewhere interesting. Then describe how you got there and why it matters — as if teaching someone.',
  'task.t4-teach.success':
    'That description will help train an AI to navigate genomes the way you do.',
  'task.t4-graduation.intro':
    'Last question. What would you want to explore further, given more time?',
  'task.t4-graduation.success':
    "That curiosity is the point. Your exploration data will help build tools that make this kind of investigation faster for everyone.",

  // === Validation feedback ===
  'validate.zoom_more': 'Zoom in a bit more. The detail is there.',
  'validate.zoom_less': 'Try zooming out to see more context.',
  'validate.pan_needed': 'Try clicking and dragging to move along the genome.',
  'validate.track_missing':
    'Open the track selector and look for the track mentioned above.',
  'validate.answer_wrong': 'Not quite. Look more carefully at the data.',
  'validate.too_fast':
    'That was fast. Take a moment to actually look at what\'s there.',
  'validate.keep_going': 'Keep exploring. Interact a bit more.',
  'validate.try_different': 'Try using different controls.',

  // === Narrator framing ===
  'narrator.welcome':
    'Welcome. You\'re about to explore a genome — a complete set of genetic instructions for a living organism. I\'ll be your guide.',
  'narrator.tier1_intro':
    "Let's learn the controls. Every tool here has a purpose.",
  'narrator.tier2_intro':
    'You know the controls. Now let\'s use them to answer questions about the biology.',
  'narrator.tier3_intro':
    "Real analysis. Multiple data types, real questions. This is what bioinformaticians do.",
  'narrator.tier4_intro':
    'You\'ve earned this. Free exploration, then graduation.',
  'narrator.graduation':
    'You\'ve demonstrated genuine skill with a genome browser. Your exploration data will help train the next generation of analysis tools. If you\'d like to participate in future sessions with larger genomes and harder challenges, your completion code enters you into the priority pool.',

  // === Fog of war ===
  'fog.blocked': 'Earn "{awardName}" first.',
  'fog.undiscovered': "There's something here you haven't tried yet.",
  'fog.lifting': 'Unlocked.',

  // === Drifting notifications (narrator gets lonely) ===
  'drift.lonely.1': "I'm still over here, in the quest panel.",
  'drift.lonely.2': "Exploring on your own? Fair enough. I'll be here when you need me.",
  'drift.lonely.3':
    "Did you know this genome has multiple data tracks available? Open the track selector to see them all.",
  'drift.encouragement.1': "You're doing well. Keep going.",
  'drift.encouragement.2': 'Every genome has surprises. Have you found yours yet?',
  'drift.hint.search_bar':
    'The search bar at the top can take you to specific positions. But navigating by hand teaches you more.',
  'drift.hint.right_click':
    'Try right-clicking on features. There\'s always more information than what\'s on the surface.',
  'drift.hint.track_menu':
    'Each track has its own menu. Look for the three-dot icon on the track header.',
} as const

export type NarratorKey = keyof typeof en

export default en
