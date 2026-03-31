;(function() {
// jbrowse-plugin-rl-analytics UMD bundle
// JBrowseExports is set by installGlobalReExports() before plugin load
var _g = typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
var _jbx = _g.JBrowseExports || {};
function __jbx(mod) {
  var m = _jbx[mod];
  if (!m) console.warn("[rl-analytics] Module not found in JBrowseExports: " + mod);
  return m || {};
}

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// plugins/rl-analytics/src/ObserverView/ObserverView.tsx
var ObserverView_exports = {};
__export(ObserverView_exports, {
  default: () => ObserverView_default
});
var {Box, Typography} = __jbx("@mui/material");
var {observer} = __jbx("mobx-react");
var {useEffect, useRef} = __jbx("react");
var {jsx, jsxs} = __jbx("react/jsx-runtime");
var ObserverView, ObserverView_default;
var init_ObserverView = __esm({
  "plugins/rl-analytics/src/ObserverView/ObserverView.tsx"() {
    "use strict";
    ObserverView = observer(function ObserverView2({
      model
    }) {
      const bottomRef = useRef(null);
      useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [model.logEntries.length]);
      return /* @__PURE__ */ jsxs(
        Box,
        {
          sx: {
            height: model.height,
            overflow: "auto",
            bgcolor: "#1a1a2e",
            color: "#e0e0e0",
            fontFamily: "monospace",
            fontSize: "0.75rem",
            p: 1,
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "#444",
              borderRadius: 3
            }
          },
          children: [
            model.logEntries.length === 0 && /* @__PURE__ */ jsx(
              Typography,
              {
                sx: {
                  color: "#666",
                  fontFamily: "monospace",
                  fontSize: "0.75rem"
                },
                children: "RL Observer \u2014 waiting for actions..."
              }
            ),
            model.logEntries.map((entry, i) => /* @__PURE__ */ jsx(Box, { sx: { py: 0.15, whiteSpace: "pre-wrap", lineHeight: 1.3 }, children: entry }, i)),
            /* @__PURE__ */ jsx("div", { ref: bottomRef })
          ]
        }
      );
    });
    ObserverView_default = ObserverView;
  }
});

// plugins/rl-analytics/src/index.ts
var {lazy} = __jbx("react");
var __t5 = __jbx("@jbrowse/core/Plugin"); var Plugin = __t5.default || __t5;
var __t6 = __jbx("@jbrowse/core/pluggableElementTypes/ViewType"); var ViewType = __t6.default || __t6;
var {isAbstractMenuManager} = __jbx("@jbrowse/core/util");
var SaveAltIcon = null;

// plugins/rl-analytics/src/ActionLogger/PatchListener.ts
var {onAction, onPatch} = __jbx("@jbrowse/mobx-state-tree");

// plugins/rl-analytics/src/ActionLogger/ActionBuffer.ts
var ActionBuffer = class {
  constructor(maxSize = 1e4, debounceMs = 100) {
    __publicField(this, "buffer", []);
    __publicField(this, "maxSize");
    __publicField(this, "debounceMs");
    __publicField(this, "pendingAction", null);
    __publicField(this, "debounceTimer", null);
    __publicField(this, "debouncedCallbacks", []);
    this.maxSize = maxSize;
    this.debounceMs = debounceMs;
  }
  /** Register a callback that fires only for debounced (merged) actions */
  onDebouncedAction(cb) {
    this.debouncedCallbacks.push(cb);
  }
  push(action) {
    if (this.pendingAction) {
      const gap = action.timestamp - this.pendingAction.timestamp;
      if (action.type === this.pendingAction.type && gap < this.debounceMs) {
        this.pendingAction = {
          ...this.pendingAction,
          timestamp: action.timestamp,
          patch: action.patch,
          reversePatch: this.pendingAction.reversePatch,
          metadata: this.mergeMetadata(this.pendingAction.metadata, action.metadata)
        };
        this.resetDebounceTimer();
        return;
      }
      const pendingIsZoom = this.pendingAction.type === "ZOOM_IN" || this.pendingAction.type === "ZOOM_OUT";
      const actionIsPan = action.type === "PAN_LEFT" || action.type === "PAN_RIGHT";
      if (pendingIsZoom && actionIsPan) {
        const sameSource = this.pendingAction.metadata.sourceAction && action.metadata.sourceAction === this.pendingAction.metadata.sourceAction;
        if (sameSource || gap < 10) {
          this.resetDebounceTimer();
          return;
        }
      }
    }
    this.flushPending();
    this.pendingAction = action;
    this.resetDebounceTimer();
  }
  mergeMetadata(prev, next) {
    const merged = { ...next };
    if (typeof prev.deltaPixels === "number" && typeof next.deltaPixels === "number") {
      merged.deltaPixels = prev.deltaPixels + next.deltaPixels;
    }
    if (prev.oldBpPerPx !== void 0) {
      merged.oldBpPerPx = prev.oldBpPerPx;
    }
    return merged;
  }
  resetDebounceTimer() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushPending();
    }, this.debounceMs);
  }
  flushPending() {
    if (this.pendingAction) {
      this.addToBuffer(this.pendingAction);
      this.pendingAction = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
  addToBuffer(action) {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(action);
    for (const cb of this.debouncedCallbacks) {
      try {
        cb(action);
      } catch {
      }
    }
  }
  /** Flush pending and return + clear all buffered actions */
  drain() {
    this.flushPending();
    const actions = [...this.buffer];
    this.buffer = [];
    return actions;
  }
  /** Flush pending and return last N actions without clearing */
  getRecent(n) {
    this.flushPending();
    return this.buffer.slice(-n);
  }
  get length() {
    return this.buffer.length + (this.pendingAction ? 1 : 0);
  }
  dispose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
};

// plugins/rl-analytics/src/ActionLogger/ActionTypes.ts
var ActionType = /* @__PURE__ */ ((ActionType2) => {
  ActionType2["ZOOM_IN"] = "ZOOM_IN";
  ActionType2["ZOOM_OUT"] = "ZOOM_OUT";
  ActionType2["PAN_LEFT"] = "PAN_LEFT";
  ActionType2["PAN_RIGHT"] = "PAN_RIGHT";
  ActionType2["SEARCH"] = "SEARCH";
  ActionType2["TOGGLE_TRACK"] = "TOGGLE_TRACK";
  ActionType2["OPEN_WIDGET"] = "OPEN_WIDGET";
  ActionType2["CLOSE_WIDGET"] = "CLOSE_WIDGET";
  ActionType2["SELECT_FEATURE"] = "SELECT_FEATURE";
  ActionType2["ADD_VIEW"] = "ADD_VIEW";
  ActionType2["UNKNOWN"] = "UNKNOWN";
  return ActionType2;
})(ActionType || {});

// plugins/rl-analytics/src/ActionLogger/ActionClassifier.ts
var classificationRules = [
  {
    pathPattern: /\/views\/\d+\/bpPerPx$/,
    op: "replace",
    classify: (patch, reversePatch) => ({
      type: patch.value < reversePatch.value ? "ZOOM_IN" /* ZOOM_IN */ : "ZOOM_OUT" /* ZOOM_OUT */,
      metadata: {
        oldBpPerPx: reversePatch.value,
        newBpPerPx: patch.value,
        zoomFactor: reversePatch.value / patch.value
      }
    })
  },
  {
    pathPattern: /\/views\/\d+\/offsetPx$/,
    op: "replace",
    classify: (patch, reversePatch) => ({
      type: patch.value > reversePatch.value ? "PAN_RIGHT" /* PAN_RIGHT */ : "PAN_LEFT" /* PAN_LEFT */,
      metadata: {
        deltaPixels: patch.value - reversePatch.value
      }
    })
  },
  {
    pathPattern: /\/views\/\d+\/displayedRegions$/,
    op: "replace",
    classify: (patch) => ({
      type: "SEARCH" /* SEARCH */,
      metadata: { regions: patch.value }
    })
  },
  {
    pathPattern: /\/views\/\d+\/tracks\/\d+$/,
    op: "add",
    classify: (patch) => {
      const val = patch.value;
      const config = val?.configuration;
      const trackId = typeof config === "string" ? config : config?.trackId ?? val?.trackId;
      return {
        type: "TOGGLE_TRACK" /* TOGGLE_TRACK */,
        metadata: { trackId, added: true }
      };
    }
  },
  {
    pathPattern: /\/views\/\d+\/tracks\/\d+$/,
    op: "remove",
    classify: (patch) => {
      const val = patch.value;
      const config = val?.configuration;
      const trackId = typeof config === "string" ? config : config?.trackId ?? val?.trackId;
      return {
        type: "TOGGLE_TRACK" /* TOGGLE_TRACK */,
        metadata: { trackId, added: false }
      };
    }
  },
  {
    pathPattern: /\/widgets\/[^/]+$/,
    op: "add",
    classify: (patch) => ({
      type: "OPEN_WIDGET" /* OPEN_WIDGET */,
      metadata: {
        widgetType: patch.value?.type
      }
    })
  },
  {
    pathPattern: /\/widgets\/[^/]+$/,
    op: "remove",
    classify: () => ({
      type: "CLOSE_WIDGET" /* CLOSE_WIDGET */,
      metadata: {}
    })
  },
  {
    pathPattern: /\/views\/\d+$/,
    op: "add",
    classify: (patch) => ({
      type: "ADD_VIEW" /* ADD_VIEW */,
      metadata: {
        viewType: patch.value?.type
      }
    })
  }
];
var ActionClassifier = class {
  classify(patch, reversePatch) {
    for (const rule of classificationRules) {
      if (rule.pathPattern.test(patch.path) && patch.op === rule.op) {
        const { type, metadata } = rule.classify(patch, reversePatch);
        return { type, timestamp: Date.now(), patch, reversePatch, metadata };
      }
    }
    return {
      type: "UNKNOWN" /* UNKNOWN */,
      timestamp: Date.now(),
      patch,
      reversePatch,
      metadata: {}
    };
  }
};

// plugins/rl-analytics/src/ActionLogger/PatchListener.ts
var PatchListener = class {
  constructor(bufferSize = 1e4, debounceMs = 100, logUnknown = false) {
    __publicField(this, "classifier", new ActionClassifier());
    __publicField(this, "buffer");
    __publicField(this, "patchDisposer", null);
    __publicField(this, "actionDisposer", null);
    __publicField(this, "callbacks", []);
    __publicField(this, "logUnknown");
    __publicField(this, "activeAction", null);
    this.buffer = new ActionBuffer(bufferSize, debounceMs);
    this.logUnknown = logUnknown;
  }
  attach(rootModel) {
    this.actionDisposer = onAction(rootModel, (call) => {
      this.activeAction = call.name;
    });
    this.patchDisposer = onPatch(rootModel, (patch, reversePatch) => {
      const action = this.classifier.classify(patch, reversePatch);
      if (action.type === "UNKNOWN" /* UNKNOWN */ && !this.logUnknown) {
        return;
      }
      if (this.activeAction) {
        action.metadata = {
          ...action.metadata,
          sourceAction: this.activeAction
        };
      }
      this.buffer.push(action);
      for (const cb of this.callbacks) {
        try {
          cb(action);
        } catch {
        }
      }
    });
  }
  onAction(callback) {
    this.callbacks.push(callback);
    return () => {
      const idx = this.callbacks.indexOf(callback);
      if (idx >= 0) {
        this.callbacks.splice(idx, 1);
      }
    };
  }
  dispose() {
    this.patchDisposer?.();
    this.actionDisposer?.();
    this.patchDisposer = null;
    this.actionDisposer = null;
    this.buffer.dispose();
    this.callbacks = [];
  }
};

// plugins/rl-analytics/src/Export/JSONLExporter.ts
var JSONLExporter = class {
  export(episodes) {
    const lines = [];
    for (const episode of episodes) {
      for (const step of episode.steps) {
        lines.push(
          JSON.stringify({
            episode_id: episode.id,
            task_id: episode.taskId,
            timestamp: step.timestamp,
            observation: step.state,
            action: step.action,
            action_metadata: step.actionMetadata,
            reward: step.reward,
            next_observation: step.nextState,
            terminated: step.terminal,
            truncated: episode.outcome === "timeout"
          })
        );
      }
    }
    return lines.join("\n");
  }
  exportAsBlob(episodes) {
    return new Blob([this.export(episodes)], {
      type: "application/x-ndjson"
    });
  }
  downloadFilename() {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    return `rl-analytics-${timestamp}.jsonl`;
  }
};

// plugins/rl-analytics/src/Export/WebhookExporter.ts
var WebhookExporter = class {
  constructor(url, batchSize = 50, intervalMs = 5e3) {
    __publicField(this, "url");
    __publicField(this, "batchSize");
    __publicField(this, "intervalMs");
    __publicField(this, "buffer", []);
    __publicField(this, "timer", null);
    this.url = url;
    this.batchSize = batchSize;
    this.intervalMs = intervalMs;
  }
  start() {
    if (!this.url) {
      return;
    }
    this.timer = setInterval(() => {
      void this.flush();
    }, this.intervalMs);
  }
  push(step, episodeId, taskId) {
    this.buffer.push({
      episode_id: episodeId,
      task_id: taskId,
      timestamp: step.timestamp,
      observation: step.state,
      action: step.action,
      action_metadata: step.actionMetadata,
      reward: step.reward,
      next_observation: step.nextState,
      terminated: step.terminal
    });
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }
  async flush() {
    if (this.buffer.length === 0 || !this.url) {
      return;
    }
    const batch = this.buffer.splice(0, this.batchSize);
    try {
      await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: batch })
      });
    } catch {
      this.buffer.unshift(...batch);
    }
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  dispose() {
    this.stop();
    if (this.buffer.length > 0 && this.url) {
      const body = JSON.stringify({ steps: this.buffer });
      this.buffer = [];
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(this.url, body);
      }
    }
  }
};

// plugins/rl-analytics/src/Export/ExportManager.ts
var ExportManager = class {
  constructor(episodeManager) {
    __publicField(this, "jsonlExporter", new JSONLExporter());
    __publicField(this, "webhookExporter", null);
    __publicField(this, "episodeManager");
    this.episodeManager = episodeManager;
  }
  configureWebhook(url, batchSize, intervalMs) {
    if (this.webhookExporter) {
      this.webhookExporter.dispose();
    }
    if (url) {
      this.webhookExporter = new WebhookExporter(url, batchSize, intervalMs);
      this.webhookExporter.start();
    }
  }
  /** Download all episodes as JSONL file */
  downloadJSONL() {
    const episodes = this.episodeManager.getAllEpisodes();
    const blob = this.jsonlExporter.exportAsBlob(episodes);
    const filename = this.jsonlExporter.downloadFilename();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  /** Get JSONL string for all episodes */
  getJSONL() {
    return this.jsonlExporter.export(this.episodeManager.getAllEpisodes());
  }
  get webhook() {
    return this.webhookExporter;
  }
  dispose() {
    this.webhookExporter?.dispose();
  }
};

// plugins/rl-analytics/src/RLPipeline/RewardCalculator.ts
var RewardCalculator = class {
  constructor() {
    __publicField(this, "recentActions", []);
  }
  calculate(_prevState, action, _nextState) {
    let reward = 0;
    reward -= 0.01;
    if (this.isOscillation(action)) {
      reward -= 0.5;
    }
    return reward;
  }
  isOscillation(action) {
    this.recentActions.push(action.type);
    if (this.recentActions.length > 6) {
      this.recentActions.shift();
    }
    if (this.recentActions.length >= 4) {
      const last4 = this.recentActions.slice(-4);
      if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
        return true;
      }
    }
    return false;
  }
  reset() {
    this.recentActions = [];
  }
};

// plugins/rl-analytics/src/RLPipeline/StateEncoder.ts
function classifyZoomLevel(bpPerPx) {
  if (bpPerPx > 100) {
    return "genome";
  }
  if (bpPerPx > 10) {
    return "region";
  }
  if (bpPerPx > 1) {
    return "gene";
  }
  if (bpPerPx > 0.1) {
    return "sequence";
  }
  return "basepair";
}
var TRACK_TYPE_CATEGORIES = {
  FeatureTrack: "hasGeneTrack",
  AlignmentsTrack: "hasAlignmentTrack",
  VariantTrack: "hasVariantTrack",
  QuantitativeTrack: "hasQuantitativeTrack",
  ReferenceSequenceTrack: "hasGeneTrack"
  // also counts
};
var StateEncoder = class {
  constructor() {
    __publicField(this, "sessionStartTime", Date.now());
    __publicField(this, "refNamesVisited", /* @__PURE__ */ new Set());
    __publicField(this, "actionCounts", {});
    __publicField(this, "totalActions", 0);
  }
  extractState(view, lastActionTimestamp, recentActionCount) {
    let bpPerPx = 1;
    let offsetPx = 0;
    let viewWidthPx = 800;
    try {
      bpPerPx = view.bpPerPx ?? 1;
      offsetPx = view.offsetPx ?? 0;
      viewWidthPx = view.width ?? 800;
    } catch {
    }
    const viewportBp = bpPerPx * viewWidthPx;
    const displayedRegions = view.displayedRegions ?? [];
    const firstRegion = displayedRegions[0] ?? {
      assemblyName: "",
      refName: "",
      start: 0,
      end: 0
    };
    const refName = firstRegion.refName || "";
    if (refName) {
      this.refNamesVisited.add(refName);
    }
    const tracks = view.tracks ?? [];
    const activeTracks = tracks.map((t) => {
      const trackId = t.configuration?.trackId ?? "";
      const trackType = t.type ?? "";
      const displays = t.displays ?? [];
      const displayType = displays[0]?.type ?? "";
      return { trackId, trackType, displayType };
    });
    let hasReferenceSequence = false;
    let hasGeneTrack = false;
    let hasAlignmentTrack = false;
    let hasVariantTrack = false;
    let hasQuantitativeTrack = false;
    for (const track of activeTracks) {
      if (track.trackType === "ReferenceSequenceTrack") {
        hasReferenceSequence = true;
      }
      const cat = TRACK_TYPE_CATEGORIES[track.trackType];
      if (cat === "hasGeneTrack") {
        hasGeneTrack = true;
      }
      if (cat === "hasAlignmentTrack") {
        hasAlignmentTrack = true;
      }
      if (cat === "hasVariantTrack") {
        hasVariantTrack = true;
      }
      if (cat === "hasQuantitativeTrack") {
        hasQuantitativeTrack = true;
      }
    }
    let visibleContentBlocks = 0;
    try {
      visibleContentBlocks = view.dynamicBlocks?.contentBlocks?.length ?? 0;
    } catch {
    }
    return {
      bpPerPx,
      offsetPx,
      viewWidthPx,
      assemblyName: firstRegion.assemblyName,
      refName,
      startBp: firstRegion.start,
      endBp: firstRegion.end,
      viewportBp,
      zoomLevel: classifyZoomLevel(bpPerPx),
      activeTracks,
      numTracks: activeTracks.length,
      visibleContentBlocks,
      hasReferenceSequence,
      hasGeneTrack,
      hasAlignmentTrack,
      hasVariantTrack,
      hasQuantitativeTrack,
      timeSinceLastAction: lastActionTimestamp > 0 ? Date.now() - lastActionTimestamp : 0,
      actionsInLast5Seconds: recentActionCount,
      sessionDurationMs: Date.now() - this.sessionStartTime,
      actionCountsByType: { ...this.actionCounts },
      uniqueRefNamesVisited: [...this.refNamesVisited],
      totalActionsThisSession: this.totalActions
    };
  }
  recordAction(actionType) {
    this.actionCounts[actionType] = (this.actionCounts[actionType] ?? 0) + 1;
    this.totalActions++;
  }
  /** Numeric vector for RL training */
  encode(state) {
    return [
      Math.log(state.bpPerPx),
      state.offsetPx / 1e3,
      state.viewWidthPx / 1e3,
      state.viewportBp / 1e6,
      state.numTracks / 10,
      // Zoom level as ordinal (0-4)
      ["genome", "region", "gene", "sequence", "basepair"].indexOf(
        state.zoomLevel
      ) / 4,
      // Track type booleans
      state.hasReferenceSequence ? 1 : 0,
      state.hasGeneTrack ? 1 : 0,
      state.hasAlignmentTrack ? 1 : 0,
      state.hasVariantTrack ? 1 : 0,
      state.hasQuantitativeTrack ? 1 : 0,
      // Temporal
      Math.log1p(state.timeSinceLastAction),
      state.actionsInLast5Seconds / 10,
      Math.log1p(state.sessionDurationMs / 1e3),
      state.totalActionsThisSession / 100,
      // Spatial diversity
      state.uniqueRefNamesVisited.length / 10,
      state.visibleContentBlocks / 10
    ];
  }
  get dimensions() {
    return 17;
  }
};

// plugins/rl-analytics/src/RLPipeline/EpisodeManager.ts
var EpisodeManager = class {
  constructor(inactivityTimeoutMs = 3e5) {
    __publicField(this, "currentEpisode", null);
    __publicField(this, "completedEpisodes", []);
    __publicField(this, "inactivityTimeout");
    __publicField(this, "inactivityTimer", null);
    __publicField(this, "stateEncoder", new StateEncoder());
    __publicField(this, "rewardCalculator", new RewardCalculator());
    __publicField(this, "lastActionTimestamp", 0);
    __publicField(this, "recentActionTimestamps", []);
    __publicField(this, "cachedState", null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __publicField(this, "getView", null);
    this.inactivityTimeout = inactivityTimeoutMs;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setViewAccessor(fn) {
    this.getView = fn;
  }
  startEpisode() {
    if (this.currentEpisode) {
      this.endEpisode("abandoned");
    }
    this.rewardCalculator.reset();
    this.cachedState = null;
    this.currentEpisode = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      steps: [],
      outcome: "in_progress",
      metadata: {}
    };
    const view = this.getView?.();
    if (view) {
      this.cachedState = this.stateEncoder.extractState(view, 0, 0);
    }
    this.startInactivityTimer();
  }
  recordAction(action) {
    if (!this.currentEpisode) {
      this.startEpisode();
    }
    const now = Date.now();
    this.recentActionTimestamps = this.recentActionTimestamps.filter(
      (t) => now - t < 5e3
    );
    this.recentActionTimestamps.push(now);
    const view = this.getView?.();
    if (!view) {
      return;
    }
    this.stateEncoder.recordAction(action.type);
    const prevState = this.cachedState ?? this.stateEncoder.extractState(
      view,
      this.lastActionTimestamp,
      this.recentActionTimestamps.length - 1
    );
    const nextState = this.stateEncoder.extractState(
      view,
      now,
      this.recentActionTimestamps.length
    );
    const reward = this.rewardCalculator.calculate(
      prevState,
      action,
      nextState
    );
    const step = {
      timestamp: now,
      state: prevState,
      action: action.type,
      actionMetadata: action.metadata,
      reward,
      nextState,
      terminal: false
    };
    this.currentEpisode.steps.push(step);
    this.lastActionTimestamp = now;
    this.cachedState = nextState;
    this.restartInactivityTimer();
    return { step, prevState, nextState };
  }
  endEpisode(outcome) {
    if (!this.currentEpisode) {
      return;
    }
    this.currentEpisode.endTime = Date.now();
    this.currentEpisode.outcome = outcome;
    this.completedEpisodes.push(this.currentEpisode);
    this.currentEpisode = null;
    this.cachedState = null;
    this.stopInactivityTimer();
  }
  getCompletedEpisodes() {
    return [...this.completedEpisodes];
  }
  getAllEpisodes() {
    const episodes = [...this.completedEpisodes];
    if (this.currentEpisode) {
      episodes.push(this.currentEpisode);
    }
    return episodes;
  }
  get currentEpisodeStepCount() {
    return this.currentEpisode?.steps.length ?? 0;
  }
  startInactivityTimer() {
    this.stopInactivityTimer();
    this.inactivityTimer = setInterval(() => {
      this.checkInactivity();
    }, 3e4);
  }
  restartInactivityTimer() {
    this.startInactivityTimer();
  }
  stopInactivityTimer() {
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
  checkInactivity() {
    if (!this.currentEpisode) {
      return;
    }
    const lastStep = this.currentEpisode.steps.at(-1);
    if (lastStep && Date.now() - lastStep.timestamp > this.inactivityTimeout) {
      this.endEpisode("timeout");
    }
  }
  dispose() {
    this.stopInactivityTimer();
  }
};

// plugins/rl-analytics/src/ObserverView/viewModel.ts
var {BaseViewModel} = __jbx("@jbrowse/core/pluggableElementTypes/models");
var {types} = __jbx("@jbrowse/mobx-state-tree");
var defaultHeight = 200;
function stateModelFactory() {
  return types.compose(
    BaseViewModel,
    types.model("RLObserverView", {
      type: types.literal("RLObserverView"),
      height: types.optional(types.number, defaultHeight),
      maxLogEntries: types.optional(types.number, 200)
    })
  ).volatile(() => ({
    logEntries: []
  })).actions((self) => ({
    setHeight(height) {
      self.height = Math.max(60, height);
    },
    addLogEntry(entry) {
      const entries = [...self.logEntries, entry];
      self.logEntries = entries.length > self.maxLogEntries ? entries.slice(-self.maxLogEntries) : entries;
    },
    clearLog() {
      self.logEntries = [];
    }
  }));
}

// plugins/rl-analytics/src/config.ts
var {ConfigurationSchema} = __jbx("@jbrowse/core/configuration");
var configSchema = ConfigurationSchema("RLAnalyticsPlugin", {
  enabled: {
    type: "boolean",
    defaultValue: true,
    description: "Enable/disable the RL analytics plugin"
  },
  actionBufferSize: {
    type: "number",
    defaultValue: 1e4,
    description: "Maximum number of actions to buffer before export"
  },
  debounceMs: {
    type: "number",
    defaultValue: 100,
    description: "Debounce window for continuous actions (ms)"
  },
  webhookUrl: {
    type: "string",
    defaultValue: "",
    description: "URL to POST action data to in real-time (empty = disabled)"
  },
  webhookBatchSize: {
    type: "number",
    defaultValue: 50,
    description: "Number of actions to batch per webhook POST"
  },
  webhookIntervalMs: {
    type: "number",
    defaultValue: 5e3,
    description: "Maximum interval between webhook POSTs (ms)"
  },
  scavengerTasksUrl: {
    type: "string",
    defaultValue: "",
    description: "URL to fetch scavenger hunt task set JSON"
  },
  autoStartScavenger: {
    type: "boolean",
    defaultValue: false,
    description: "Auto-open scavenger hunt widget on session start"
  },
  rewardShaping: {
    type: "string",
    defaultValue: "potential",
    description: 'Reward shaping strategy: "potential", "sparse", or "dense"'
  },
  inactivityTimeoutMs: {
    type: "number",
    defaultValue: 3e5,
    description: "Inactivity timeout for episode segmentation (ms)"
  },
  logUnknownPatches: {
    type: "boolean",
    defaultValue: false,
    description: "Log unclassified MST patches (for debugging/discovery)"
  }
});
var config_default = configSchema;

// plugins/rl-analytics/src/index.ts
var RLAnalyticsPlugin = class extends Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "name", "RLAnalyticsPlugin");
    __publicField(this, "configurationSchema", config_default);
    __publicField(this, "patchListener", null);
    __publicField(this, "episodeManager", null);
    __publicField(this, "exportManager", null);
    __publicField(this, "observerModel", null);
  }
  install(pluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: "RLObserverView",
        displayName: "RL Observer",
        stateModel: stateModelFactory(),
        ReactComponent: lazy(
          () => Promise.resolve().then(() => (init_ObserverView(), ObserverView_exports))
        )
      });
    });
  }
  configure(pluginManager) {
    const rootModel = pluginManager.rootModel;
    if (!rootModel) {
      return;
    }
    this.patchListener?.dispose();
    this.episodeManager?.dispose();
    this.exportManager?.dispose();
    this.patchListener = new PatchListener(1e4, 500, false);
    this.episodeManager = new EpisodeManager(3e5);
    this.exportManager = new ExportManager(this.episodeManager);
    const getView = () => {
      const session2 = rootModel.session;
      if (!session2?.views) {
        return void 0;
      }
      return session2.views.find((v) => v.type === "LinearGenomeView");
    };
    this.episodeManager.setViewAccessor(getView);
    this.patchListener.buffer.onDebouncedAction((action) => {
      queueMicrotask(() => {
        const result = this.episodeManager.recordAction(action);
        if (this.observerModel) {
          if (result) {
            this.logToObserver(result.step, result.nextState);
          } else {
            this.observerModel.addLogEntry(
              `${action.type} \u2014 no view for state extraction`
            );
          }
        }
      });
    });
    const session = rootModel.session;
    if (session) {
      this.patchListener.attach(session);
    }
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu("Add", {
        label: "RL Observer",
        onClick: () => {
          const session2 = rootModel.session;
          if (session2) {
            const view = session2.addView("RLObserverView", {});
            this.observerModel = view;
          }
        }
      });
      rootModel.appendToMenu("Tools", {
        label: "Export RL Data (JSONL)",
        icon: SaveAltIcon,
        onClick: () => {
          this.exportManager?.downloadJSONL();
        }
      });
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("rlObserver")) {
        const session2 = rootModel.session;
        if (session2) {
          const view = session2.addView("RLObserverView", {});
          this.observerModel = view;
        }
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logToObserver(step, state) {
    if (!this.observerModel) {
      return;
    }
    const ts = new Date(step.timestamp).toISOString().slice(11, 23);
    const action = step.action;
    const meta = step.actionMetadata;
    const zl = state.zoomLevel;
    const bp = state.bpPerPx.toFixed(2);
    const ref = state.refName;
    const tracks = state.numTracks;
    const reward = step.reward.toFixed(3);
    const eps = this.episodeManager?.currentEpisodeStepCount ?? 0;
    let detail = "";
    if (meta.deltaPixels !== void 0) {
      detail = ` \u0394${Math.round(meta.deltaPixels)}px`;
    }
    if (meta.zoomFactor !== void 0) {
      detail = ` \xD7${meta.zoomFactor.toFixed(2)}`;
    }
    if (meta.trackId !== void 0) {
      detail = ` ${meta.trackId}`;
    }
    if (meta.widgetType !== void 0) {
      detail = ` ${meta.widgetType}`;
    }
    const trackFlags = [
      state.hasReferenceSequence ? "ref" : null,
      state.hasGeneTrack ? "gene" : null,
      state.hasAlignmentTrack ? "aln" : null,
      state.hasVariantTrack ? "var" : null,
      state.hasQuantitativeTrack ? "quant" : null
    ].filter(Boolean).join(",");
    const src = meta.sourceAction ? ` (${meta.sourceAction})` : "";
    const line = `${ts} [${zl.padEnd(8)}] ${action.padEnd(14)}${detail.padEnd(20)} ${ref}:${bp}bp/px  trk=${tracks}[${trackFlags}]  r=${reward}  step=${eps}${src}`;
    this.observerModel.addLogEntry(line);
  }
  /** Public accessors for testing */
  getExportManager() {
    return this.exportManager;
  }
  getEpisodeManager() {
    return this.episodeManager;
  }
  getPatchListener() {
    return this.patchListener;
  }
};


var __rl_plugin_default = RLAnalyticsPlugin;


var Plugin = typeof __rl_plugin_default !== "undefined" ? __rl_plugin_default : null;
if (!Plugin) { console.error("[rl-analytics] Plugin class not found"); return; }
_g.JBrowsePluginRLAnalyticsPlugin = { default: Plugin };
})();
