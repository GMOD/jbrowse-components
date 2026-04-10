# JBrowse Analytics & AI Assistance — Proposal for Leadership

## Overview

This document summarizes our thinking on a proposal to add user telemetry to JBrowse 2, with the goal of training an AI model to assist with genomic data exploration. We've done a technical evaluation of the approach, built a privacy-respecting alternative, and outlined a path forward that we think leadership will find credible and actionable.

---

## What Was Proposed

The original proposal ("rl-analytics") would instrument JBrowse with per-session telemetry — sequences of user actions, viewport coordinates, and search queries — and use that data to train a reinforcement learning (RL) agent to model user behavior.

We appreciate the intent: understanding how users interact with JBrowse is genuinely valuable, and AI-assisted navigation is a compelling long-term goal. That said, after reviewing the approach carefully, we have some concerns we think are worth working through before committing to this direction.

---

## Our Concerns with the RL Approach

### The reward signal is hard to define

RL requires a reward function — a way to tell the model whether a given action was good or bad. In open-ended genomic exploration, this is genuinely difficult. A user zooming into a region and then back out might be finding what they need, getting confused, or just exploring a hypothesis. From the action sequence alone, it's nearly impossible to tell. Without a clear reward signal, the model can't learn in a meaningful way.

This isn't a dealbreaker on its own — it just means the system would be doing behavioral cloning (learning to mimic common patterns) rather than true RL. That's a narrower claim and worth being upfront about.

### The training data would average across very different use cases

JBrowse is used for variant review, gene model curation, RNA-seq QC, comparative genomics, and a lot more. A model trained on pooled sessions would learn a kind of average browsing pattern, which may not be useful for any individual researcher's specific task. The signal-to-noise ratio is a real concern.

### Privacy is a significant constraint

Genomic data is among the most sensitive categories of personal information. It is heritable, it implicates family members, and it is subject to regulatory frameworks that vary by institution and jurisdiction. Even with informed consent, collecting browsing coordinates and search queries introduces risk:

- Precise chromosomal loci can reveal what conditions or variants a lab is studying, before publication
- Search strings may contain gene names, variant IDs, or sample identifiers
- Track names and file paths can identify datasets and their origins

This doesn't mean analytics are off the table — it means we need to be deliberate about what we collect and how we handle it.

---

## What We Built Instead

We implemented a lightweight analytics plugin that collects only aggregate feature usage data — no coordinates, no search text, no file paths, nothing that could identify a user or a dataset.

**Collected (as aggregate counts only):**
- Which features are used and how often (zoom, pan, search, track show/hide, view types)
- Action transition patterns — e.g., how often users search and then zoom, or open a widget after selecting a feature
- Which dialogs, widgets, and menu items are used
- Error types (messages sanitized to remove any URLs or paths)
- Session length buckets (`<1min`, `1–5min`, `5–15min`, `15–30min`, `30min+`)
- Desktop-specific: which start screen pathways users take

**Not collected:**
- Genomic coordinates of any kind
- Search query content
- Track identifiers, file names, or data source URLs
- Any information that could identify a user, institution, or dataset

All aggregation happens on the client. A single anonymized summary is sent at session end. This gives us solid product analytics — which features are loved, which are ignored, where users run into errors — without requiring any data governance infrastructure or creating compliance risk for our users.

---

## A Better Path for AI Assistance

Rather than training a general-purpose RL agent on open-ended session data, we'd suggest a narrower framing: pick one or two specific, high-value workflows and build AI assistance directly into those.

Two good candidates:

**Variant analysis review (e.g., alongside DeepVariant output)**
A researcher has called variants and wants to review candidates. The task is well-scoped: the relevant tracks are known, the decision criteria are documented, and the output is a classification (keep / flag / reject). An AI assistant here can be prompted with the visible genomic context and offer structured guidance. Training data can come from published variant datasets with known ground truth — no user telemetry needed.

**Gene model curation (e.g., reviewing Tiberius or Augustus predictions)**
A user is checking predicted gene models against transcript and alignment evidence. Again, the task is bounded, the criteria are known, and the output is a set of edits. An AI assistant can evaluate what's in view against biological rules, without needing to learn from session logs.

Both of these approaches have clear success criteria, can be evaluated against held-out biological data, and deliver concrete value on a specific task rather than diffuse "assistance" on everything.

---

## If the RL Direction Remains on the Table

If leadership wants to continue exploring RL, there are ways to do it more responsibly. The following techniques would significantly reduce privacy risk while preserving much of the signal:

### 1. Local differential privacy before transmission
Add calibrated noise to each count before sending (e.g., Laplace mechanism with ε = 1.0). Individual sessions become deniable; aggregate trends across thousands of sessions remain visible. This is the same technique used by Apple and Google for keyboard and emoji usage analytics.

### 2. Coordinate bucketing, not raw positions
Instead of transmitting exact genomic coordinates, bin them: chromosome arm (p/q), megabase window, or simply "coding region / non-coding / repeat". This preserves enough spatial context to understand navigation patterns without revealing which locus was studied.

### 3. Train on synthetic sessions, validate on real aggregate statistics
Generate synthetic browsing sessions from public datasets (1000 Genomes, gnomAD, ENCODE) that cover the range of JBrowse use cases. Train the model on those. Use the real aggregate analytics (from our plugin) only for validation — checking that model-generated sessions match the distribution of real ones. No individual session data ever enters the training pipeline.

### 4. On-device training only
Keep the model on the user's machine and never transmit raw session data at all. Use federated learning to aggregate model weight updates (not data) across installs. This is technically heavier but eliminates the data collection question entirely.

### 5. Scope to a single, consented cohort first
Rather than broad collection, pilot with a small number of research groups who explicitly opt in, review the data with them, and publish the methodology before expanding. This builds trust and surfaces privacy edge cases before they become incidents.

---

## A More Direct Path: JBrowse as an MCP Server

One proposal on the table is building a JBrowse MCP server — exposing the browser's state and actions to an AI assistant via the [Model Context Protocol](https://modelcontextprotocol.io). It is worth evaluating this seriously, because it addresses the same goals as the RL proposal but from a completely different angle.

### What MCP is

MCP is an open protocol, developed by Anthropic, that lets an AI assistant (Claude, or any compatible model) connect to external tools and data sources in a structured way. An MCP server exposes a set of typed tools and resources; the AI calls them in response to natural language requests. It is the same mechanism that lets Claude browse the web, read files, or query a database — without any custom training.

### What a JBrowse MCP server would look like

A JBrowse MCP server would expose tools that map directly onto what the browser can do:

```
navigate_to(assemblyName, refName, start, end)
search_features(query)            ← gene name, variant ID, etc.
show_track(trackId)
hide_track(trackId)
set_zoom(bpPerPx)
get_current_view()                ← returns viewport state, visible tracks
get_features_in_view()            ← returns features currently on screen
add_track(config)
open_widget(widgetType)
```

With these tools in place, a researcher could type a natural-language request — "zoom in to the highest-confidence variant on chromosome 17" or "show me the splicing evidence for this gene model" — and the AI assistant would issue the appropriate sequence of tool calls to carry it out. The user stays in control; the assistant handles the mechanical navigation.

### Why this is a stronger proposal than the RL approach

The RL proposal aimed to build an agent that *learns* navigation policies from user session data. MCP sidesteps the entire learning problem:

- **No reward signal needed.** The AI reasons about the user's request using a pre-trained language model. There is no training loop, no reward function to design, and no behavioral cloning from user sessions.
- **No user data collected.** Each interaction is handled in real time. Nothing is logged or aggregated for training. The privacy concerns that apply to the telemetry proposal simply do not arise.
- **The capability is available now.** Current frontier models can already interpret genomic context, reason about variant evidence, and sequence tool calls to accomplish multi-step navigation tasks. We would not be building toward a capability — we would be wiring up an existing one.
- **It generalizes across tasks.** A trained RL agent is specialized to whatever task distribution it was trained on. An MCP-connected LLM can handle novel requests it has never seen, as long as it has access to the right tools and context.

### Relationship to the scavenger hunt

The scavenger hunt system in the RL proposal was essentially trying to teach navigation through guided, pre-authored tasks. An MCP server makes that approach unnecessary: a user who wants to find a specific locus or feature can simply ask the assistant in plain language. The elaborate task configuration, tier system, and reward shaping machinery all become redundant.

More pointedly: the scavenger hunt's reward signal was synthetic and pre-authored (navigate to a hard-coded target coordinate). That means it never needed real user data in the first place — and an MCP server achieves the same navigational capability without the overhead.

### What MCP does not replace

MCP is a session-level, interactive capability. It does not give us aggregate product intelligence — which features are underused, where users hit errors, how session length correlates with track configuration. The aggregate analytics plugin we have built remains the right instrument for those questions. The two are complementary: analytics tells us what to build, MCP is part of what we build.

### Concrete proposal

We recommend scoping a JBrowse MCP server as a focused project with the following initial tool surface:

1. Read-only state tools: `get_current_view`, `get_features_in_view`, `search_features`
2. Navigation tools: `navigate_to`, `set_zoom`
3. Track management: `show_track`, `hide_track`, `add_track`

A working prototype could likely be built in a few weeks and demoed against a real biological question (e.g., "walk me through the variant evidence at this locus"). That demo would be far more compelling to stakeholders than a training pipeline with a `reward: 0` placeholder — and it would be built on infrastructure the community is already adopting.

---

## Summary

| Approach | Privacy risk | Technical confidence | User value | Our take |
|---|---|---|---|---|
| RL on raw session telemetry | High | Low–moderate | Uncertain | Not recommended as-is |
| Aggregate feature analytics | Minimal | High (implemented) | High for product decisions | Ship it |
| JBrowse MCP server | None | High | High — interactive AI assistance today | Strongly recommended |
| Task-specific AI assistance (scoped workflows) | None | Moderate | High for target workflows | Strong long-term bet |
| RL with differential privacy + synthetic training | Low–moderate | Moderate | Moderate | Viable only if RL is a hard requirement |

Our recommendation is to ship the aggregate analytics plugin now and pursue the MCP server as a near-term project. Together they address the original goals more directly than the RL proposal — one gives us product intelligence, the other gives users interactive AI assistance — without requiring any collection of sensitive session data. Task-specific AI workflows (variant review, gene model curation) are a natural follow-on once the MCP tool surface is in place. If there is still strong interest in the RL direction after that, the privacy-preserving variant is a reasonable path, but we would want a concrete reward signal design before committing to it.

We're happy to discuss any of this further.
