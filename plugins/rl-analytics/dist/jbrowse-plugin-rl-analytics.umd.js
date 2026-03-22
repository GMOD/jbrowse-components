;(function() {
// jbrowse-plugin-rl-analytics UMD bundle
// JBrowseExports is set by installGlobalReExports() before plugin load
var _g = typeof self !== "undefined" ? self : window;
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

// plugins/rl-analytics/src/ScavengerHunt/TaskValidator.ts
function jaroWinkler(s1, s2) {
  if (s1 === s2) {
    return 1;
  }
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) {
    return 0;
  }
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) {
        continue;
      }
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) {
    return 0;
  }
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) {
      continue;
    }
    while (!s2Matches[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      transpositions++;
    }
    k++;
  }
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}
var TaskValidator;
var init_TaskValidator = __esm({
  "plugins/rl-analytics/src/ScavengerHunt/TaskValidator.ts"() {
    "use strict";
    TaskValidator = class {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(getView) {
        this.getView = getView;
      }
      validate(task, model) {
        switch (task.type) {
          case "navigate":
            return this.validateNavigation(task, model);
          case "identify":
            return this.validateIdentification(task, model);
          case "compare":
            return this.validateComparison(task, model);
          case "freeform":
            return this.validateFreeform(task, model);
        }
      }
      validateNavigation(task, model) {
        if (!task.target) {
          return { valid: false, reason: "No target defined" };
        }
        const view = this.getView();
        if (!view) {
          return { valid: false, reason: "No active view" };
        }
        const contentBlocks = view.dynamicBlocks?.contentBlocks ?? [];
        const visible = contentBlocks.some(
          (block) => block.refName === task.target.refName && block.start <= task.target.end && block.end >= task.target.start
        );
        if (!visible) {
          return { valid: false, reason: "Target region not in viewport" };
        }
        if (task.requiredTracks) {
          const activeTrackIds = (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            view.tracks?.map((t) => t.configuration?.trackId) ?? []
          );
          const missingTracks = task.requiredTracks.filter(
            (t) => !activeTrackIds.includes(t)
          );
          if (missingTracks.length > 0) {
            return {
              valid: false,
              reason: `Missing tracks: ${missingTracks.join(", ")}`
            };
          }
        }
        const startTime = model.taskStartTimes.get(task.id);
        if (startTime && task.minTimeSeconds) {
          const elapsed = (Date.now() - startTime) / 1e3;
          if (elapsed < task.minTimeSeconds) {
            return {
              valid: false,
              reason: "Completed too quickly \u2014 please explore more carefully"
            };
          }
        }
        return { valid: true };
      }
      validateIdentification(task, model) {
        const answer = model.answers.get(task.id);
        if (!answer) {
          return { valid: false, reason: "No answer provided" };
        }
        if (task.answerChoices && task.expectedAnswer) {
          return {
            valid: answer === task.expectedAnswer,
            reason: answer === task.expectedAnswer ? void 0 : "Incorrect answer"
          };
        }
        if (task.expectedAnswer) {
          const similarity = jaroWinkler(
            answer.toLowerCase(),
            task.expectedAnswer.toLowerCase()
          );
          return {
            valid: similarity > 0.85,
            reason: similarity > 0.85 ? void 0 : "Answer does not match expected"
          };
        }
        return { valid: true };
      }
      validateComparison(task, model) {
        const answer = model.answers.get(task.id);
        if (!answer) {
          return { valid: false, reason: "No answer provided" };
        }
        if (task.expectedAnswer) {
          const similarity = jaroWinkler(
            answer.toLowerCase(),
            task.expectedAnswer.toLowerCase()
          );
          return {
            valid: similarity > 0.85,
            reason: similarity > 0.85 ? void 0 : "Answer does not match expected"
          };
        }
        return { valid: true };
      }
      validateFreeform(task, model) {
        const answer = model.answers.get(task.id);
        if (!answer || answer.trim().length === 0) {
          return { valid: false, reason: "Please provide an answer" };
        }
        if (task.expectedAnswer) {
          const similarity = jaroWinkler(
            answer.toLowerCase(),
            task.expectedAnswer.toLowerCase()
          );
          return {
            valid: similarity > 0.85,
            reason: similarity > 0.85 ? void 0 : "Answer does not match expected"
          };
        }
        return { valid: true };
      }
    };
  }
});

// plugins/rl-analytics/src/ScavengerHunt/components/AnswerInput.tsx
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography
} from "@mui/material";
var { observer } = __jbx("mobx-react");
var { useState } = __jbx("react");
var { jsx, jsxs } = __jbx("react/jsx-runtime");
var AnswerInput, AnswerInput_default;
var init_AnswerInput = __esm({
  "plugins/rl-analytics/src/ScavengerHunt/components/AnswerInput.tsx"() {
    "use strict";
    AnswerInput = observer(function AnswerInput2({
      task,
      currentAnswer,
      onSubmit
    }) {
      const [localAnswer, setLocalAnswer] = useState(currentAnswer);
      if (task.type === "navigate") {
        return null;
      }
      return /* @__PURE__ */ jsxs(Box, { sx: { mt: 2 }, children: [
        /* @__PURE__ */ jsx(Typography, { variant: "subtitle2", sx: { mb: 1 }, children: "Your Answer" }),
        task.answerChoices ? /* @__PURE__ */ jsxs(FormControl, { children: [
          /* @__PURE__ */ jsx(
            RadioGroup,
            {
              value: localAnswer,
              onChange: (e) => {
                setLocalAnswer(e.target.value);
              },
              children: task.answerChoices.map((choice) => /* @__PURE__ */ jsx(
                FormControlLabel,
                {
                  value: choice,
                  control: /* @__PURE__ */ jsx(Radio, {}),
                  label: choice
                },
                choice
              ))
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "contained",
              size: "small",
              sx: { mt: 1 },
              onClick: () => {
                onSubmit(localAnswer);
              },
              disabled: !localAnswer,
              children: "Submit Answer"
            }
          )
        ] }) : /* @__PURE__ */ jsxs(Box, { children: [
          /* @__PURE__ */ jsx(
            TextField,
            {
              fullWidth: true,
              size: "small",
              value: localAnswer,
              onChange: (e) => {
                setLocalAnswer(e.target.value);
              },
              placeholder: "Type your answer...",
              sx: { mb: 1 }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "contained",
              size: "small",
              onClick: () => {
                onSubmit(localAnswer);
              },
              disabled: !localAnswer.trim(),
              children: "Submit Answer"
            }
          )
        ] })
      ] });
    });
    AnswerInput_default = AnswerInput;
  }
});

// plugins/rl-analytics/src/ScavengerHunt/components/CompletionScreen.tsx
var { Box as Box2, Card, CardContent, Typography as Typography2 } = __jbx("@mui/material");
var { observer as observer2 } = __jbx("mobx-react");
var { Fragment, jsx as jsx2, jsxs as jsxs2 } = __jbx("react/jsx-runtime");
var CompletionScreen, CompletionScreen_default;
var init_CompletionScreen = __esm({
  "plugins/rl-analytics/src/ScavengerHunt/components/CompletionScreen.tsx"() {
    "use strict";
    CompletionScreen = observer2(function CompletionScreen2({
      model
    }) {
      return /* @__PURE__ */ jsx2(Card, { children: /* @__PURE__ */ jsxs2(CardContent, { children: [
        /* @__PURE__ */ jsx2(Typography2, { variant: "h5", sx: { mb: 2 }, children: "All tasks complete!" }),
        model.completionCode ? /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx2(Typography2, { sx: { mb: 1 }, children: "Your completion code:" }),
          /* @__PURE__ */ jsx2(
            Box2,
            {
              sx: {
                p: 2,
                bgcolor: "grey.100",
                borderRadius: 1,
                textAlign: "center",
                mb: 2
              },
              children: /* @__PURE__ */ jsx2(
                Typography2,
                {
                  variant: "h4",
                  sx: { fontFamily: "monospace", letterSpacing: 2 },
                  children: model.completionCode
                }
              )
            }
          ),
          /* @__PURE__ */ jsx2(Typography2, { variant: "caption", color: "text.secondary", children: "Copy this code back to the MTurk HIT page." })
        ] }) : /* @__PURE__ */ jsx2(Typography2, { children: "Generating completion code..." })
      ] }) });
    });
    CompletionScreen_default = CompletionScreen;
  }
});

// plugins/rl-analytics/src/ScavengerHunt/components/ProgressBar.tsx
var { Box as Box3, LinearProgress, Typography as Typography3 } = __jbx("@mui/material");
var { observer as observer3 } = __jbx("mobx-react");
var { jsx as jsx3, jsxs as jsxs3 } = __jbx("react/jsx-runtime");
var ProgressBar, ProgressBar_default;
var init_ProgressBar = __esm({
  "plugins/rl-analytics/src/ScavengerHunt/components/ProgressBar.tsx"() {
    "use strict";
    ProgressBar = observer3(function ProgressBar2({
      model
    }) {
      return /* @__PURE__ */ jsxs3(Box3, { sx: { mb: 2 }, children: [
        /* @__PURE__ */ jsxs3(Box3, { sx: { display: "flex", justifyContent: "space-between", mb: 0.5 }, children: [
          /* @__PURE__ */ jsx3(Typography3, { variant: "body2", children: "Progress" }),
          /* @__PURE__ */ jsxs3(Typography3, { variant: "body2", children: [
            model.completedTaskIds.length,
            " / ",
            model.tasks.length
          ] })
        ] }),
        /* @__PURE__ */ jsx3(LinearProgress, { variant: "determinate", value: model.progress * 100 })
      ] });
    });
    ProgressBar_default = ProgressBar;
  }
});

// plugins/rl-analytics/src/ScavengerHunt/components/TaskCard.tsx
var { Alert, Button as Button2, Card as Card2, CardContent as CardContent2, CardHeader, Chip, Typography as Typography4 } = __jbx("@mui/material");
var { observer as observer4 } = __jbx("mobx-react");
var { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs4 } = __jbx("react/jsx-runtime");
var TaskCard, TaskCard_default;
var init_TaskCard = __esm({
  "plugins/rl-analytics/src/ScavengerHunt/components/TaskCard.tsx"() {
    "use strict";
    TaskCard = observer4(function TaskCard2({
      task,
      hintsRevealed,
      onRevealHint
    }) {
      return /* @__PURE__ */ jsxs4(Card2, { sx: { mb: 2 }, children: [
        /* @__PURE__ */ jsx4(
          CardHeader,
          {
            title: /* @__PURE__ */ jsxs4(Fragment2, { children: [
              /* @__PURE__ */ jsx4(
                Chip,
                {
                  label: `Tier ${task.tier}`,
                  size: "small",
                  color: task.tier === 1 ? "success" : task.tier === 2 ? "warning" : "error",
                  sx: { mr: 1 }
                }
              ),
              /* @__PURE__ */ jsx4(Typography4, { variant: "h6", component: "span", children: task.title })
            ] })
          }
        ),
        /* @__PURE__ */ jsxs4(CardContent2, { children: [
          /* @__PURE__ */ jsx4(Typography4, { sx: { mb: 2 }, children: task.description }),
          Array.from({ length: hintsRevealed }, (_, i) => /* @__PURE__ */ jsxs4(Alert, { severity: "info", sx: { mb: 1 }, children: [
            "Hint ",
            i + 1,
            ": ",
            task.hints[i]
          ] }, i)),
          hintsRevealed < task.hints.length && /* @__PURE__ */ jsxs4(Button2, { variant: "outlined", size: "small", onClick: onRevealHint, children: [
            "Reveal Hint (",
            task.hints.length - hintsRevealed,
            " remaining)"
          ] })
        ] })
      ] });
    });
    TaskCard_default = TaskCard;
  }
});

// plugins/rl-analytics/src/ScavengerHunt/components/ScavengerHuntWidget.tsx
var ScavengerHuntWidget_exports = {};
__export(ScavengerHuntWidget_exports, {
  default: () => ScavengerHuntWidget_default
});
var { Alert as Alert2, Box as Box4, Button as Button3, Typography as Typography5 } = __jbx("@mui/material");
var { observer as observer5 } = __jbx("mobx-react");
var { useEffect, useState as useState2 } = __jbx("react");
var { jsx as jsx5, jsxs as jsxs5 } = __jbx("react/jsx-runtime");
var ScavengerHuntWidget, ScavengerHuntWidget_default;
var init_ScavengerHuntWidget = __esm({
  "plugins/rl-analytics/src/ScavengerHunt/components/ScavengerHuntWidget.tsx"() {
    "use strict";
    init_TaskValidator();
    init_AnswerInput();
    init_CompletionScreen();
    init_ProgressBar();
    init_TaskCard();
    ScavengerHuntWidget = observer5(function ScavengerHuntWidget2({
      model
    }) {
      const [validationError, setValidationError] = useState2(null);
      const [taskStarted, setTaskStarted] = useState2(false);
      const currentTask = model.currentTask;
      useEffect(() => {
        if (currentTask && !taskStarted) {
          model.startCurrentTask();
          setTaskStarted(true);
        }
      }, [currentTask, taskStarted, model]);
      useEffect(() => {
        setTaskStarted(false);
        setValidationError(null);
      }, [model.currentTaskIndex]);
      if (model.isComplete) {
        if (!model.completionCode) {
          void model.generateCompletionCode();
        }
        return /* @__PURE__ */ jsx5(CompletionScreen_default, { model });
      }
      if (!currentTask) {
        return /* @__PURE__ */ jsx5(Box4, { sx: { p: 2 }, children: /* @__PURE__ */ jsx5(Typography5, { children: "No tasks loaded. Load a task set to begin." }) });
      }
      const handleValidateAndAdvance = () => {
        const validator = new TaskValidator(() => null);
        const result = validator.validate(currentTask, model);
        if (result.valid) {
          model.completeCurrentTask();
          setValidationError(null);
        } else {
          setValidationError(result.reason ?? "Validation failed");
        }
      };
      return /* @__PURE__ */ jsxs5(Box4, { sx: { p: 2 }, children: [
        /* @__PURE__ */ jsx5(ProgressBar_default, { model }),
        /* @__PURE__ */ jsx5(
          TaskCard_default,
          {
            task: currentTask,
            hintsRevealed: model.currentHintsRevealed,
            onRevealHint: () => {
              model.revealHint();
            }
          }
        ),
        /* @__PURE__ */ jsx5(
          AnswerInput_default,
          {
            task: currentTask,
            currentAnswer: model.answers.get(currentTask.id) ?? "",
            onSubmit: (answer) => {
              model.submitAnswer(answer);
            }
          }
        ),
        validationError && /* @__PURE__ */ jsx5(Alert2, { severity: "warning", sx: { mt: 1, mb: 1 }, children: validationError }),
        /* @__PURE__ */ jsx5(
          Button3,
          {
            variant: "contained",
            color: "primary",
            sx: { mt: 2 },
            onClick: handleValidateAndAdvance,
            children: currentTask.type === "navigate" ? "Check Position" : "Submit & Continue"
          }
        )
      ] });
    });
    ScavengerHuntWidget_default = ScavengerHuntWidget;
  }
});

// plugins/rl-analytics/src/index.ts
var { lazy } = __jbx("react");
var __t17 = __jbx("@jbrowse/core/Plugin"); var Plugin = __t17.default || __t17;
var { WidgetType } = __jbx("@jbrowse/core/pluggableElementTypes");
import {
  isAbstractMenuManager,
  isSessionModelWithWidgets
} from "@jbrowse/core/util";
var AssessmentIcon = null;
var ExploreIcon = null;
var SaveAltIcon = null;

// plugins/rl-analytics/src/ActionLogger/PatchListener.ts
var { onPatch } = __jbx("@jbrowse/mobx-state-tree");

// plugins/rl-analytics/src/ActionLogger/ActionBuffer.ts
var ActionBuffer = class {
  constructor(maxSize = 1e4, debounceMs = 100) {
    __publicField(this, "buffer", []);
    __publicField(this, "maxSize");
    __publicField(this, "debounceMs");
    __publicField(this, "pendingAction", null);
    __publicField(this, "debounceTimer", null);
    this.maxSize = maxSize;
    this.debounceMs = debounceMs;
  }
  push(action) {
    if (this.pendingAction && action.type === this.pendingAction.type && action.timestamp - this.pendingAction.timestamp < this.debounceMs) {
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
    classify: (patch) => ({
      type: "TOGGLE_TRACK" /* TOGGLE_TRACK */,
      metadata: {
        trackId: patch.value?.trackId,
        added: true
      }
    })
  },
  {
    pathPattern: /\/views\/\d+\/tracks\/\d+$/,
    op: "remove",
    classify: (patch) => ({
      type: "TOGGLE_TRACK" /* TOGGLE_TRACK */,
      metadata: {
        trackId: patch.value?.trackId,
        added: false
      }
    })
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
    __publicField(this, "disposer", null);
    __publicField(this, "callbacks", []);
    __publicField(this, "logUnknown");
    this.buffer = new ActionBuffer(bufferSize, debounceMs);
    this.logUnknown = logUnknown;
  }
  attach(rootModel) {
    this.disposer = onPatch(rootModel, (patch, reversePatch) => {
      const action = this.classifier.classify(patch, reversePatch);
      if (action.type === "UNKNOWN" /* UNKNOWN */ && !this.logUnknown) {
        return;
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
    this.disposer?.();
    this.disposer = null;
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
  calculate(prevState, action, nextState, taskConfig) {
    let reward = 0;
    if (taskConfig && nextState.taskActive) {
      const prevDistance = prevState.distanceToTargetBp ?? Infinity;
      const nextDistance = nextState.distanceToTargetBp ?? Infinity;
      const gamma = 0.99;
      const prevPotential = -Math.log1p(Math.abs(prevDistance));
      const nextPotential = -Math.log1p(Math.abs(nextDistance));
      reward += gamma * nextPotential - prevPotential;
      if (nextState.targetVisible && !prevState.targetVisible) {
        reward += 5;
      }
      if (nextState.targetFullyVisible && taskConfig.type === "navigate") {
        reward += 10;
      }
    }
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
var StateEncoder = class {
  extractState(view, lastActionTimestamp, recentActionCount, taskConfig) {
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
    const tracks = view.tracks ?? [];
    const activeTracks = tracks.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t) => t.configuration?.trackId ?? ""
    );
    let taskActive = false;
    let distanceToTargetBp;
    let targetVisible;
    let targetFullyVisible;
    if (taskConfig?.target) {
      taskActive = true;
      const viewCenterBp = firstRegion.start + viewportBp / 2;
      const targetCenter = (taskConfig.target.start + taskConfig.target.end) / 2;
      if (firstRegion.refName === taskConfig.target.refName) {
        distanceToTargetBp = targetCenter - viewCenterBp;
      }
      const contentBlocks = view.dynamicBlocks?.contentBlocks ?? [];
      targetVisible = contentBlocks.some(
        (block) => block.refName === taskConfig.target.refName && block.start <= taskConfig.target.end && block.end >= taskConfig.target.start
      );
      targetFullyVisible = contentBlocks.some(
        (block) => block.refName === taskConfig.target.refName && block.start <= taskConfig.target.start && block.end >= taskConfig.target.end
      );
    }
    return {
      bpPerPx,
      offsetPx,
      viewWidthPx,
      assemblyName: firstRegion.assemblyName,
      refName: firstRegion.refName,
      startBp: firstRegion.start,
      endBp: firstRegion.end,
      viewportBp,
      activeTracks,
      numTracks: activeTracks.length,
      taskActive,
      targetRefName: taskConfig?.target?.refName,
      targetStartBp: taskConfig?.target?.start,
      targetEndBp: taskConfig?.target?.end,
      distanceToTargetBp,
      targetVisible,
      targetFullyVisible,
      timeSinceLastAction: lastActionTimestamp > 0 ? Date.now() - lastActionTimestamp : 0,
      actionsInLast5Seconds: recentActionCount
    };
  }
  encode(state) {
    return [
      Math.log(state.bpPerPx),
      state.offsetPx / 1e3,
      state.viewWidthPx / 1e3,
      state.viewportBp / 1e6,
      state.numTracks / 10,
      state.taskActive ? 1 : 0,
      state.distanceToTargetBp ? Math.sign(state.distanceToTargetBp) * Math.log1p(Math.abs(state.distanceToTargetBp)) : 0,
      state.targetVisible ? 1 : 0,
      state.targetFullyVisible ? 1 : 0,
      Math.log1p(state.timeSinceLastAction),
      state.actionsInLast5Seconds / 10
    ];
  }
  get dimensions() {
    return 11;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __publicField(this, "getView", null);
    __publicField(this, "activeTaskConfig");
    this.inactivityTimeout = inactivityTimeoutMs;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setViewAccessor(fn) {
    this.getView = fn;
  }
  setTaskConfig(taskConfig) {
    this.activeTaskConfig = taskConfig;
  }
  startEpisode(taskConfig) {
    if (this.currentEpisode) {
      this.endEpisode("abandoned");
    }
    this.activeTaskConfig = taskConfig;
    this.rewardCalculator.reset();
    this.currentEpisode = {
      id: crypto.randomUUID(),
      taskId: taskConfig?.id,
      startTime: Date.now(),
      steps: [],
      outcome: "in_progress",
      metadata: { taskConfig }
    };
    this.startInactivityTimer();
  }
  recordAction(action) {
    if (!this.currentEpisode) {
      this.startEpisode(this.activeTaskConfig);
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
    const prevState = this.stateEncoder.extractState(
      view,
      this.lastActionTimestamp,
      this.recentActionTimestamps.length - 1,
      this.activeTaskConfig
    );
    const nextState = this.stateEncoder.extractState(
      view,
      now,
      this.recentActionTimestamps.length,
      this.activeTaskConfig
    );
    const reward = this.rewardCalculator.calculate(
      prevState,
      action,
      nextState,
      this.activeTaskConfig
    );
    const terminal = this.activeTaskConfig?.type === "navigate" && !!nextState.targetFullyVisible;
    const step = {
      timestamp: now,
      state: prevState,
      action: action.type,
      actionMetadata: action.metadata,
      reward,
      nextState,
      terminal
    };
    this.currentEpisode.steps.push(step);
    this.lastActionTimestamp = now;
    this.restartInactivityTimer();
    if (terminal) {
      this.endEpisode("completed");
    }
  }
  endEpisode(outcome) {
    if (!this.currentEpisode) {
      return;
    }
    this.currentEpisode.endTime = Date.now();
    this.currentEpisode.outcome = outcome;
    this.completedEpisodes.push(this.currentEpisode);
    this.currentEpisode = null;
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

// plugins/rl-analytics/src/config.ts
var { ConfigurationSchema } = __jbx("@jbrowse/core/configuration");
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

// plugins/rl-analytics/src/ScavengerHunt/model.ts
var { ConfigurationSchema as ConfigurationSchema2 } = __jbx("@jbrowse/core/configuration");
var { ElementId } = __jbx("@jbrowse/core/util/types/mst");
var { types } = __jbx("@jbrowse/mobx-state-tree");
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function sha256Hex(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var TaskConfigModel = types.model("TaskConfig", {
  id: types.identifier,
  type: types.enumeration(["navigate", "identify", "compare", "freeform"]),
  tier: types.union(types.literal(1), types.literal(2), types.literal(3)),
  title: types.string,
  description: types.string,
  hints: types.array(types.string),
  target: types.maybe(
    types.model({
      assemblyName: types.string,
      refName: types.string,
      start: types.number,
      end: types.number
    })
  ),
  expectedAnswer: types.maybe(types.string),
  answerChoices: types.maybe(types.array(types.string)),
  validationFn: types.maybe(types.string),
  minTimeSeconds: types.maybe(types.number),
  maxTimeSeconds: types.maybe(types.number),
  requiredTracks: types.maybe(types.array(types.string)),
  completionReward: types.optional(types.number, 1)
});
var configSchema2 = ConfigurationSchema2("ScavengerHuntWidget", {});
var ScavengerHuntModel = types.model("ScavengerHuntWidget", {
  id: ElementId,
  type: types.literal("ScavengerHuntWidget"),
  taskSetId: types.optional(types.string, ""),
  tasks: types.array(TaskConfigModel),
  currentTaskIndex: types.optional(types.number, 0),
  taskOrder: types.array(types.number),
  completedTaskIds: types.array(types.string),
  taskStartTimes: types.map(types.number),
  taskEndTimes: types.map(types.number),
  hintsRevealed: types.map(types.number),
  answers: types.map(types.string),
  workerId: types.optional(types.string, ""),
  assignmentId: types.optional(types.string, "")
}).volatile(() => ({
  completionCode: null
})).views((self) => ({
  get currentTask() {
    const idx = self.taskOrder[self.currentTaskIndex];
    return idx !== void 0 ? self.tasks[idx] : void 0;
  },
  get progress() {
    return self.tasks.length > 0 ? self.completedTaskIds.length / self.tasks.length : 0;
  },
  get isComplete() {
    return self.tasks.length > 0 && self.completedTaskIds.length === self.tasks.length;
  },
  get currentHintsRevealed() {
    const task = self.taskOrder[self.currentTaskIndex];
    const taskModel = task !== void 0 ? self.tasks[task] : void 0;
    if (!taskModel) {
      return 0;
    }
    return self.hintsRevealed.get(taskModel.id) ?? 0;
  }
})).actions((self) => ({
  loadTaskSet(taskSet) {
    self.tasks.clear();
    for (const task of taskSet.tasks) {
      self.tasks.push(task);
    }
    self.taskSetId = taskSet.id;
    const indices = [...Array(taskSet.tasks.length).keys()];
    self.taskOrder.clear();
    const order = taskSet.randomizeOrder ? shuffleArray(indices) : indices;
    for (const i of order) {
      self.taskOrder.push(i);
    }
  },
  startCurrentTask() {
    const task = self.currentTask;
    if (task) {
      self.taskStartTimes.set(task.id, Date.now());
    }
  },
  revealHint() {
    const task = self.currentTask;
    if (!task) {
      return;
    }
    const current = self.hintsRevealed.get(task.id) ?? 0;
    if (current < task.hints.length) {
      self.hintsRevealed.set(task.id, current + 1);
    }
  },
  submitAnswer(answer) {
    const task = self.currentTask;
    if (!task) {
      return;
    }
    self.answers.set(task.id, answer);
  },
  completeCurrentTask() {
    const task = self.currentTask;
    if (!task) {
      return;
    }
    self.taskEndTimes.set(task.id, Date.now());
    self.completedTaskIds.push(task.id);
    if (self.currentTaskIndex < self.tasks.length - 1) {
      self.currentTaskIndex += 1;
    }
  },
  setWorkerId(id) {
    self.workerId = id;
  },
  setAssignmentId(id) {
    self.assignmentId = id;
  },
  setCompletionCode(code) {
    self.completionCode = code;
  },
  async generateCompletionCode() {
    const payload = `${self.assignmentId}:${self.taskSetId}:${self.completedTaskIds.join(",")}`;
    const hash = await sha256Hex(payload);
    self.completionCode = hash.slice(0, 12).toUpperCase();
  }
}));

// plugins/rl-analytics/src/index.ts
var RLAnalyticsPlugin = class extends Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "name", "RLAnalyticsPlugin");
    __publicField(this, "configurationSchema", config_default);
    __publicField(this, "patchListener", null);
    __publicField(this, "episodeManager", null);
    __publicField(this, "exportManager", null);
  }
  install(pluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: "ScavengerHuntWidget",
        heading: "Scavenger Hunt",
        configSchema: configSchema2,
        stateModel: ScavengerHuntModel,
        ReactComponent: lazy(
          () => Promise.resolve().then(() => (init_ScavengerHuntWidget(), ScavengerHuntWidget_exports))
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
    this.patchListener = new PatchListener(1e4, 100, false);
    this.episodeManager = new EpisodeManager(3e5);
    this.exportManager = new ExportManager(this.episodeManager);
    this.episodeManager.setViewAccessor(() => {
      const session2 = rootModel.session;
      if (!session2?.views) {
        return void 0;
      }
      return session2.views.find((v) => v.type === "LinearGenomeView");
    });
    this.patchListener.onAction((action) => {
      queueMicrotask(() => {
        this.episodeManager.recordAction(action);
      });
    });
    const session = rootModel.session;
    if (session) {
      this.patchListener.attach(session);
    }
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu("Tools", {
        label: "Scavenger Hunt",
        icon: ExploreIcon,
        onClick: () => {
          const session2 = rootModel.session;
          if (isSessionModelWithWidgets(session2)) {
            let widget = session2.widgets.get("ScavengerHunt");
            if (!widget) {
              widget = session2.addWidget(
                "ScavengerHuntWidget",
                "ScavengerHunt"
              );
            }
            session2.showWidget(widget);
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
      rootModel.appendToMenu("Tools", {
        label: "RL Analytics Status",
        icon: AssessmentIcon,
        onClick: () => {
          const episodes = this.episodeManager?.getAllEpisodes() ?? [];
          const totalSteps = episodes.reduce(
            (sum, ep) => sum + ep.steps.length,
            0
          );
          const completed = episodes.filter(
            (ep) => ep.outcome === "completed"
          ).length;
          alert(
            `RL Analytics Status

Episodes: ${episodes.length}
Completed: ${completed}
Total steps: ${totalSteps}
Buffer size: ${this.patchListener?.buffer.length ?? 0}`
          );
        }
      });
    }
    this.loadTasksFromUrl(pluginManager);
  }
  /** Public accessors for testing and external integration */
  getExportManager() {
    return this.exportManager;
  }
  getEpisodeManager() {
    return this.episodeManager;
  }
  getPatchListener() {
    return this.patchListener;
  }
  loadTasksFromUrl(pluginManager) {
    if (typeof window === "undefined") {
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const tasksUrl = urlParams.get("scavengerTasks");
    const workerId = urlParams.get("workerId") ?? "";
    const assignmentId = urlParams.get("assignmentId") ?? "";
    if (tasksUrl) {
      void fetch(tasksUrl).then((r) => r.json()).then((taskSet) => {
        const session = pluginManager.rootModel?.session;
        if (isSessionModelWithWidgets(session)) {
          const widget = session.addWidget(
            "ScavengerHuntWidget",
            "ScavengerHunt",
            {}
          );
          const model = widget;
          model.loadTaskSet(taskSet);
          if (workerId) {
            model.setWorkerId(workerId);
          }
          if (assignmentId) {
            model.setAssignmentId(assignmentId);
          }
          session.showWidget(widget);
        }
      }).catch((err) => {
        console.error("Failed to load scavenger hunt tasks:", err);
      });
    }
  }
};



var Plugin = typeof __rl_plugin_default !== "undefined" ? __rl_plugin_default : null;
if (!Plugin) { console.error("[rl-analytics] Plugin class not found"); return; }
_g.JBrowsePluginRLAnalyticsPlugin = { default: Plugin };
})();
