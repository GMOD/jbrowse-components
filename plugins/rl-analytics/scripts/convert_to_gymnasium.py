#!/usr/bin/env python3
"""Convert JSONL episode data to Gymnasium/d3rlpy-compatible NumPy arrays."""

import json
import math
import sys
from pathlib import Path

import numpy as np

ACTION_MAP = {
    "ZOOM": 0,
    "PAN": 1,
    "NAV_TO": 2,
    "SHOW_TRACK": 3,
    "HIDE_TRACK": 4,
    "REORDER_TRACK": 5,
    "CONFIG_CHANGE": 6,
    "OPEN_WIDGET": 7,
    "BOOKMARK": 8,
    "UNDO": 9,
    "ADD_VIEW": 10,
    "REMOVE_VIEW": 11,
    "FLIP_VIEW": 12,
    "OTHER": 13,
}

ZOOM_LEVELS = {"genome": 0, "region": 1, "gene": 2, "sequence": 3, "basepair": 4}


def encode_state(obs: dict) -> list[float]:
    """Encode a BrowserState observation dict into a numeric vector (21 dims)."""
    bp_per_px = obs.get("bpPerPx", 1.0)
    zoom_level = ZOOM_LEVELS.get(obs.get("zoomLevel", "gene"), 2)
    return [
        math.log(max(bp_per_px, 1e-10)),
        obs.get("offsetPx", 0) / 1000,
        obs.get("viewWidthPx", 800) / 1000,
        obs.get("viewportBp", 0) / 1e6,
        obs.get("numTracks", 0) / 10,
        zoom_level / 4,
        # Track type booleans
        1.0 if obs.get("hasReferenceSequence") else 0.0,
        1.0 if obs.get("hasGeneTrack") else 0.0,
        1.0 if obs.get("hasAlignmentTrack") else 0.0,
        1.0 if obs.get("hasVariantTrack") else 0.0,
        1.0 if obs.get("hasQuantitativeTrack") else 0.0,
        # Temporal
        math.log1p(obs.get("timeSinceLastAction", 0)),
        obs.get("actionsInLast5Seconds", 0) / 10,
        math.log1p(obs.get("sessionDurationMs", 0) / 1000),
        obs.get("totalActionsThisSession", 0) / 100,
        # Spatial diversity
        len(obs.get("uniqueRefNamesVisited", [])) / 10,
        obs.get("visibleContentBlocks", 0) / 10,
        # New fields
        obs.get("viewportCenterBp", 0) / 1e6,
        1.0 if obs.get("labelsVisible") else 0.0,
        len(obs.get("openWidgets", [])) / 5,
        len(obs.get("displayedRegions", [])) / 5,
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
        [ACTION_MAP.get(s["action"], ACTION_MAP["OTHER"]) for s in steps],
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
    print(f"  Action types: {dict(zip(*np.unique(actions, return_counts=True)))}")
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
