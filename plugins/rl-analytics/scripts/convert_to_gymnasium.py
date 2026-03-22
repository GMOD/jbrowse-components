#!/usr/bin/env python3
"""Convert JSONL episode data to Gymnasium/d3rlpy-compatible NumPy arrays."""

import json
import math
import sys
from pathlib import Path

import numpy as np

ACTION_MAP = {
    "ZOOM_IN": 0,
    "ZOOM_OUT": 1,
    "PAN_LEFT": 2,
    "PAN_RIGHT": 3,
    "SEARCH": 4,
    "TOGGLE_TRACK": 5,
    "OPEN_WIDGET": 6,
    "CLOSE_WIDGET": 7,
    "SELECT_FEATURE": 8,
    "ADD_VIEW": 9,
    "UNKNOWN": 10,
}


def encode_state(obs: dict) -> list[float]:
    """Encode a BrowserState observation dict into a numeric vector."""
    bp_per_px = obs.get("bpPerPx", 1.0)
    distance = obs.get("distanceToTargetBp")
    return [
        math.log(max(bp_per_px, 1e-10)),
        obs.get("offsetPx", 0) / 1000,
        obs.get("viewWidthPx", 800) / 1000,
        obs.get("viewportBp", 0) / 1e6,
        obs.get("numTracks", 0) / 10,
        1.0 if obs.get("taskActive") else 0.0,
        (
            math.copysign(1, distance) * math.log1p(abs(distance))
            if distance is not None
            else 0.0
        ),
        1.0 if obs.get("targetVisible") else 0.0,
        1.0 if obs.get("targetFullyVisible") else 0.0,
        math.log1p(obs.get("timeSinceLastAction", 0)),
        obs.get("actionsInLast5Seconds", 0) / 10,
    ]


def convert(jsonl_path: str, output_path: str) -> None:
    """Convert a JSONL file to a .npz file compatible with d3rlpy."""
    steps = [json.loads(line) for line in open(jsonl_path) if line.strip()]

    if not steps:
        print("No steps found in input file.", file=sys.stderr)
        sys.exit(1)

    observations = np.array(
        [encode_state(s["observation"]) for s in steps], dtype=np.float32
    )
    actions = np.array(
        [ACTION_MAP.get(s["action"], ACTION_MAP["UNKNOWN"]) for s in steps],
        dtype=np.int64,
    )
    rewards = np.array([s["reward"] for s in steps], dtype=np.float32)
    terminals = np.array([s["terminated"] for s in steps], dtype=bool)
    timeouts = np.array([s.get("truncated", False) for s in steps], dtype=bool)

    np.savez(
        output_path,
        observations=observations,
        actions=actions,
        rewards=rewards,
        terminals=terminals,
        timeouts=timeouts,
    )

    print(f"Converted {len(steps)} steps to {output_path}")
    print(f"  Observations shape: {observations.shape}")
    print(f"  Actions shape: {actions.shape}")
    print(f"  Episodes: {terminals.sum() + timeouts.sum()}")


def main() -> None:
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <input.jsonl> [output.npz]", file=sys.stderr)
        sys.exit(1)

    jsonl_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else str(Path(jsonl_path).with_suffix(".npz"))
    convert(jsonl_path, output_path)


if __name__ == "__main__":
    main()
