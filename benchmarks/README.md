# JBrowse Alignments Performance Benchmarks

This directory contains benchmarks for measuring the performance improvements in
the alignments plugin, particularly for SNPCoverage rendering and CRAM/BAM file
processing.

## Directory Structure

```
benchmarks/
├── run_all_benchmarks.sh     # Master script - runs all benchmarks
├── cigar/                     # CIGAR string generation micro-benchmarks
│   ├── bench_cigar_simple.mjs # Synthetic data benchmark for readFeaturesToCIGAR
│   ├── bench_cigar.mjs        # Real CRAM data benchmark (requires file setup)
│   └── bench_cigar_bam.mjs    # Real BAM data benchmark (requires file setup)
└── end-to-end/                # Full end-to-end rendering benchmarks
    ├── run_all_cram.sh        # Runs all CRAM end-to-end tests
    ├── run_all_bam.sh         # Runs all BAM end-to-end tests
    ├── bench_with_profiling.mjs     # Main benchmark with profiling metrics
    ├── bench_shortread.mjs    # 200x shortread CRAM benchmark with screenshots
    ├── bench_shortread_bam.mjs # 200x shortread BAM benchmark with screenshots
    ├── bench_longread.mjs     # 200x longread CRAM benchmark with screenshots
    ├── bench_longread_bam.mjs # 200x longread BAM benchmark with screenshots
    ├── bench_large_region.mjs # 20x longread CRAM on large 160kb region
    ├── bench_large_region_bam.mjs # 20x longread BAM on large 160kb region
    ├── bench_20x_shortread_large.mjs # 20x shortread CRAM on large region
    ├── bench_20x_shortread_large_bam.mjs # 20x shortread BAM on large region
    └── screenshots/           # Visual verification screenshots
```

## Prerequisites

Before running benchmarks, ensure:

1. Test data is available in `test_data/` directory (in repository root):
   - CRAM/BAM files (200x and 20x coverage, short and long reads)
   - Reference genome (hg19mod.fa)
   - Index files (.crai, .bai, .fai)

2. For automated benchmarks: The system will handle repository setup and server
   management

3. For manual benchmarks: Two JBrowse instances running on:
   - **Port 3000**: Branch 1 (configured in `config.sh`)
   - **Port 3001**: Branch 2 (configured in `config.sh`)

## Configuration

Edit `benchmarks/config.sh` to configure which branches to test:

```bash
export BRANCH1="newopts"      # First branch to test
export BRANCH2="main"          # Second branch to test
export BRANCH3=""              # Optional third branch

# Labels will automatically use branch names from git
# You can override them if needed:
# export LABEL1="my-custom-label"
```

## Running Benchmarks

### Option 1: Fully Automated (Recommended)

This handles everything - setup, servers, benchmarks, cleanup:

```bash
./benchmarks/full_benchmark.sh
```

### Option 2: Manual Steps

**Step 1: Setup branches** (one time, or when switching branches)

```bash
./benchmarks/setup_branches.sh [branch1] [branch2] [branch3]
```

**Step 2: Start servers**

```bash
./benchmarks/start_servers.sh
```

**Step 3: Run benchmarks**

```bash
./benchmarks/run_all_benchmarks.sh
```

**Step 4: Stop servers**

```bash
./benchmarks/stop_servers.sh
```

### Option 3: Manual - Servers Already Running

If you already have servers running on the configured ports:

```bash
./benchmarks/run_all_benchmarks.sh
```

### Run Specific Benchmark Suites

#### CIGAR Micro-benchmark

Tests the `readFeaturesToCIGAR` function optimization:

```bash
cd benchmarks/cigar
node bench_cigar_simple.mjs  # Synthetic data
node bench_cigar.mjs         # Real CRAM data
node bench_cigar_bam.mjs     # Real BAM data
```

#### End-to-End Benchmarks

Compares full rendering pipeline between master and optimized:

```bash
cd benchmarks/end-to-end
./run_all_cram.sh  # Run all CRAM benchmarks
./run_all_bam.sh   # Run all BAM benchmarks
```

Or run individual tests:

```bash
# CRAM benchmarks
node bench_shortread.mjs      # 200x shortread CRAM with screenshots
node bench_longread.mjs        # 200x longread CRAM with screenshots
node bench_large_region.mjs    # Large 160kb region CRAM
node bench_20x_shortread_large.mjs # 20x shortread CRAM on large region

# BAM benchmarks
node bench_shortread_bam.mjs   # 200x shortread BAM with screenshots
node bench_longread_bam.mjs    # 200x longread BAM with screenshots
node bench_large_region_bam.mjs # Large 160kb region BAM
node bench_20x_shortread_large_bam.mjs # 20x shortread BAM on large region
```

## Benchmark Results

### Expected Improvements

| Test Case            | Baseline | Optimized | Improvement |
| -------------------- | -------- | --------- | ----------- |
| 200x Shortread (3kb) | ~10s     | ~7.6s     | **+24-28%** |
| 200x Longread (3kb)  | ~15s     | ~14.6s    | **+1-3%**   |
| 20x Longread (160kb) | ~22.5s   | ~21.8s    | **+3%**     |
| CIGAR generation     | 317ms    | 293ms     | **+7.6%**   |

### Key Optimizations

1. **Pre-allocated bins** - Eliminated lazy initialization
2. **Pre-computed sorted keys** - Sort once, not every render
3. **Optimized loops** - Direct index calculation, reduced operations
4. **Array-based string building** - Avoided O(n²) concatenation
5. **Cached calculations** - Reduced redundant computations

## Output

- **Console**: Real-time progress and summary statistics
- **JSON files**: `results_*.json` - Detailed metrics
- **Screenshots**: `end-to-end/screenshots/` - Visual verification

## Troubleshooting

### "Connection refused" errors

Ensure both dev servers are running on ports 3000 and 3001.

### "Cannot find test_data" errors

Run benchmarks from the repository root directory.

### Benchmark variance

Run multiple times and average results. Performance can vary based on system
load.
