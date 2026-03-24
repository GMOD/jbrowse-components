use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};

use clap::Parser;

/// Converts GFA to tabix-indexed pos.bed.gz + segments.gz files.
///
/// Streaming two-pass approach: O(segments) memory.
/// Segment ordinals are assigned in path-traversal order so that
/// reference-path queries span compact ordinal ranges in segments.gz.
/// List the reference assembly's paths first in the GFA for best performance.
///
/// By default, walks whose segments ALL have opposite orientation to the
/// reference are normalized (orient flipped, offsets reversed). This removes
/// false inversions caused by reverse-complemented assembly contigs while
/// preserving genuine biological inversions. Inspired by odgi groom
/// (https://github.com/pangenome/odgi); for more thorough normalization,
/// preprocess with: odgi groom -R ref_paths.txt
#[derive(Parser)]
#[command(name = "gfa-to-tabix")]
struct Args {
    /// Input GFA file (plain or .gz)
    gfa_file: String,

    /// Output prefix (default: derived from input filename)
    output_prefix: Option<String>,

    /// Number of walk steps per pos.bed.gz chunk
    #[arg(long, default_value_t = 100)]
    chunk_size: usize,

    /// Comma-separated list of assemblies to include
    #[arg(long)]
    assemblies: Option<String>,

    /// Produce per-assembly sharded segments files
    #[arg(long)]
    sharded: bool,

    /// Disable orientation normalization of reverse-complemented contigs
    #[arg(long)]
    no_groom: bool,

    /// Assembly name to use as reference for grooming (default: first assembly in GFA).
    /// Should match the assembly used for browsing in JBrowse.
    #[arg(long)]
    ref_assembly: Option<String>,
}

fn main() {
    let cli = Args::parse();

    let gfa_path = &cli.gfa_file;
    let output_prefix = cli.output_prefix.unwrap_or_else(|| {
        gfa_path
            .trim_end_matches(".gz")
            .trim_end_matches(".gfa")
            .to_string()
    });

    let chunk_size = cli.chunk_size;
    let assemblies_filter: Option<HashSet<String>> = cli
        .assemblies
        .map(|s| s.split(',').map(|s| s.to_string()).collect());
    let sharded = cli.sharded;
    let groom = !cli.no_groom;
    let ref_assembly_arg = cli.ref_assembly;

    // Pass 1: collect segment lengths from S-lines.  Numeric IDs are NOT
    // assigned here — they are assigned during path traversal in Pass 2 so
    // that graph nodes visited consecutively by the first assembly get
    // consecutive IDs.  This keeps the ID lists in pos.bed.gz compact for that
    // assembly's queries, reducing the number of byte-range reads against
    // segments.gz.
    eprintln!("Pass 1: Reading segments...");
    let mut seg_lengths: HashMap<String, u64> = HashMap::new();
    let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
    let mut next_ordinal: u64 = 0;

    for line in open_file(gfa_path).lines() {
        let line = line.expect("read error");
        if !line.starts_with("S\t") {
            continue;
        }
        let mut parts = line.splitn(4, '\t');
        parts.next();
        let name = parts.next().expect("missing segment name").to_string();
        let seq = parts.next().expect("missing segment sequence");
        let length = parts
            .next()
            .and_then(|rest| {
                rest.split('\t')
                    .find(|t| t.starts_with("LN:i:"))
                    .map(|t| t[5..].parse::<u64>().unwrap_or(0))
            })
            .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 });
        seg_lengths.insert(name, length);
    }
    eprintln!("  {} segments", seg_lengths.len());

    // Pass 2: walk each path, assigning numeric IDs to graph nodes on first
    // encounter, and emitting both pos.bed.gz chunks (with explicit ID lists)
    // and segments.tsv rows (one per path×node, later sorted by numeric ID).
    eprintln!("Pass 2: Processing paths...");

    let tmp_dir = output_parent(&output_prefix).join(format!(".gfa-tmp-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir).expect("failed to create temp dir");

    let pos_file = format!("{}.pos.bed.gz", output_prefix);
    let mut pos_proc = spawn_sort_bgzip(&pos_file);
    let mut pos_w = BufWriter::new(pos_proc.stdin.take().unwrap());

    let combined_tmp = tmp_dir.join("segments.tsv");
    let mut segments_files: HashMap<String, BufWriter<File>> = HashMap::new();
    if !sharded {
        segments_files.insert(
            String::new(),
            BufWriter::new(File::create(&combined_tmp).expect("create temp")),
        );
    }

    let mut genomes: Vec<String> = Vec::new();
    let mut genome_set: HashSet<String> = HashSet::new();
    // Map from segment ordinal → reference orient (true = "+").
    // Populated by the first assembly's paths (the reference).
    let mut ref_orients: HashMap<u64, bool> = HashMap::new();
    let mut ref_assembly: Option<String> = None;
    let mut path_names: Vec<String> = Vec::new();
    let mut path_name_indices: HashMap<String, u64> = HashMap::new();
    let mut path_sizes: Vec<(String, u64)> = Vec::new();
    let mut path_count: u64 = 0;

    for line in open_file(gfa_path).lines() {
        let line = line.expect("read error");

        let parsed = if line.starts_with("W\t") {
            parse_walk(&line)
        } else if line.starts_with("P\t") {
            parse_p_line(&line)
        } else {
            None
        };

        if let Some((path_name, assembly, seg_str, is_walk)) = parsed {
            if let Some(ref filter) = assemblies_filter {
                if !filter.contains(&assembly) {
                    continue;
                }
            }
            if genome_set.insert(assembly.clone()) {
                genomes.push(assembly.clone());
            }

            // Use --ref-assembly if provided, otherwise the first assembly.
            let is_ref = match &ref_assembly {
                None => {
                    if let Some(ref ra) = ref_assembly_arg {
                        if *ra == assembly {
                            ref_assembly = Some(assembly.clone());
                            true
                        } else {
                            false
                        }
                    } else {
                        ref_assembly = Some(assembly.clone());
                        true
                    }
                }
                Some(ra) => *ra == assembly,
            };

            let path_index = if let Some(&idx) = path_name_indices.get(&path_name) {
                idx
            } else {
                let idx = path_names.len() as u64;
                path_name_indices.insert(path_name.clone(), idx);
                path_names.push(path_name.clone());
                idx
            };

            let segments_key = if sharded { assembly.clone() } else { String::new() };
            if !segments_files.contains_key(&segments_key) {
                let p = tmp_dir.join(format!("{}.tsv", encode_filename(&assembly)));
                segments_files.insert(
                    segments_key.clone(),
                    BufWriter::new(File::create(&p).expect("create shard temp")),
                );
            }
            let segments_w = segments_files.get_mut(&segments_key).unwrap();

            let total = emit_path_rows(
                &path_name,
                path_index,
                &seg_str,
                is_walk,
                chunk_size,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut pos_w,
                segments_w,
                &mut ref_orients,
                is_ref,
                groom,
            );

            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }

    if let Some(ref ra) = ref_assembly {
        eprintln!("  Reference assembly: {} ({} orient entries)", ra, ref_orients.len());
    }

    // Headers
    let header = format!("#genomes={}\n", genomes.join(","));
    let sizes_str: Vec<String> = path_sizes
        .iter()
        .map(|(n, s)| format!("{}:{}", n, s))
        .collect();
    let sizes_header = format!("#sizes={}\n", sizes_str.join(","));
    let paths_header = format!("#paths={}\n", path_names.join(","));
    let full_header = format!("{}{}{}", header, sizes_header, paths_header);

    // Finish pos.bed.gz
    pos_w.write_all(header.as_bytes()).unwrap();
    pos_w.write_all(sizes_header.as_bytes()).unwrap();
    pos_w.write_all(paths_header.as_bytes()).unwrap();
    drop(pos_w);
    assert!(
        pos_proc.wait().map(|s| s.success()).unwrap_or(false),
        "pos sort|bgzip failed"
    );
    run_cmd("tabix", &["-c", "#", "-p", "bed", &pos_file]);

    // Flush segment temp files
    drop(segments_files);

    // Build segments.gz + .gzi + .idx
    if sharded {
        let segs_dir = format!("{}_segments", output_prefix);
        fs::create_dir_all(&segs_dir).unwrap();
        let mut manifest_entries: Vec<(String, String)> = Vec::new();

        for genome in &genomes {
            let encoded = encode_filename(genome);
            let tmp_path = tmp_dir.join(format!("{}.tsv", encoded));
            let out_prefix = format!("{}/{}.segments", segs_dir, encoded);
            sort_and_build_segments(
                &tmp_path.to_string_lossy(),
                &full_header,
                &out_prefix,
                next_ordinal,
                &tmp_dir.to_string_lossy(),
            );
            let _ = fs::remove_file(&tmp_path);
            let dir_base = segs_dir.rsplit('/').next().unwrap_or(&segs_dir);
            manifest_entries.push((
                genome.clone(),
                format!("{}/{}.segments", dir_base, encoded),
            ));
        }

        write_manifest(
            &format!("{}.segments.manifest.json", output_prefix),
            &genomes,
            &manifest_entries,
        );
    } else {
        sort_and_build_segments(
            &combined_tmp.to_string_lossy(),
            &full_header,
            &format!("{}.segments", output_prefix),
            next_ordinal,
            &tmp_dir.to_string_lossy(),
        );
        let _ = fs::remove_file(&combined_tmp);
    }

    let _ = fs::remove_dir_all(&tmp_dir);

    eprintln!("Done.");
    eprintln!("  Segments: {}", seg_lengths.len());
    eprintln!("  Paths: {}", path_count);
    eprintln!("  Genomes: {} ({})", genomes.len(), genomes.join(", "));
}

/// Sort the unsorted segments TSV by ordinal, build the companion byte-offset
/// index (.idx), and compress to .gz + .gzi via bgzip.
///
/// The .idx file is a flat array of little-endian u64 values, one per numeric
/// ID.  idx[N] = byte offset in the *uncompressed* segments data where node N's
/// rows begin.  The viewer loads this into a BigUint64Array and uses it to
/// convert node ID lists (from pos.bed.gz) into precise byte-range reads
/// against the bgzf-compressed segments file.
///
/// Disk: only the unsorted input + final compressed output (no sorted
/// intermediate).
fn sort_and_build_segments(
    unsorted_path: &str,
    header: &str,
    output_prefix: &str,
    total_ordinals: u64,
    sort_tmp_dir: &str,
) {
    let gz_file = format!("{}.gz", output_prefix);
    let idx_file = format!("{}.idx", output_prefix);

    // sort → our process → bgzip
    // We read sorted lines from sort's stdout, track byte offsets for the
    // companion index, and write header + lines to bgzip's stdin.
    let mut sort_proc = Command::new("sh")
        .args([
            "-c",
            &format!(
                "sort -S 2G -T \"{}\" -t\"\t\" -k1,1n \"{}\"",
                sort_tmp_dir, unsorted_path
            ),
        ])
        .env("LC_ALL", "C")
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to spawn sort");

    let final_tmp = format!("{}.prebgzip", unsorted_path);
    let mut out = BufWriter::new(File::create(&final_tmp).expect("create prebgzip"));
    out.write_all(header.as_bytes()).unwrap();

    let mut index_offsets: Vec<u64> = Vec::new();
    let mut byte_offset = header.len() as u64;
    let mut last_ord: i64 = -1;

    let sort_stdout = sort_proc.stdout.take().unwrap();
    for line in BufReader::new(sort_stdout).lines() {
        let line = line.expect("read sorted line");
        if line.is_empty() {
            continue;
        }
        let seg_ord: u64 = line[..line.find('\t').unwrap_or(line.len())]
            .parse()
            .unwrap_or(0);

        if seg_ord as i64 != last_ord {
            while (index_offsets.len() as u64) <= seg_ord {
                index_offsets.push(byte_offset);
            }
            last_ord = seg_ord as i64;
        }

        let row = format!("{}\n", line);
        out.write_all(row.as_bytes()).unwrap();
        byte_offset += row.len() as u64;
    }

    while (index_offsets.len() as u64) <= total_ordinals {
        index_offsets.push(byte_offset);
    }
    drop(out);

    assert!(
        sort_proc.wait().map(|s| s.success()).unwrap_or(false),
        "sort failed for {}",
        unsorted_path
    );

    // bgzip with companion index
    run_cmd("bgzip", &["-i", &final_tmp]);
    fs::rename(format!("{}.gz", final_tmp), &gz_file).expect("rename gz");
    fs::rename(format!("{}.gz.gzi", final_tmp), format!("{}.gzi", gz_file)).expect("rename gzi");

    // Write companion index
    let mut idx_out = BufWriter::new(File::create(&idx_file).expect("create idx"));
    for offset in &index_offsets {
        idx_out.write_all(&offset.to_le_bytes()).unwrap();
    }
}

/// Process one path (P-line or W-line walk) from the GFA, emitting:
///
///   - segments.tsv rows: one row per step with the segment's numeric ID (a
///     sequential integer we assign to each unique graph node), path name,
///     base-pair offset along the path, segment length, orientation, and
///     segment name.  These are later sorted by numeric ID and compressed into
///     segments.gz with a companion byte-offset index (.idx).
///
///   - pos.bed.gz rows: one row per chunk of `chunk_size` steps.  Each row is
///     a BED-like line (path, start_bp, end_bp) with a 4th column containing a
///     comma-separated list of the *exact* numeric IDs of graph nodes traversed
///     by that chunk.  The viewer uses this list to look up only the specific
///     nodes it needs from segments.gz, avoiding huge range reads.  (An earlier
///     format stored only min/max IDs per chunk, which caused multi-GB reads
///     when a path mixed shared and assembly-private nodes whose IDs were far
///     apart in the file.)
///
/// Numeric IDs are assigned on first encounter: the first path to traverse a
/// graph node determines its ID.  This means the GFA's path ordering matters —
/// assemblies listed earlier get tighter, more contiguous ID sequences.
/// A buffered step from parsing a walk, before writing to segments.tsv.
struct WalkStep {
    ord: u64,
    seg_len: u64,
    is_plus: bool,
}

fn emit_path_rows(
    path_name: &str,
    path_index: u64,
    seg_str: &str,
    is_walk: bool,
    chunk_size: usize,
    seg_lengths: &HashMap<String, u64>,
    seg_ordinals: &mut HashMap<String, u64>,
    next_ordinal: &mut u64,
    pos_w: &mut BufWriter<impl Write>,
    segments_w: &mut BufWriter<File>,
    ref_orients: &mut HashMap<u64, bool>,
    is_ref: bool,
    groom: bool,
) -> u64 {
    // Phase 1: parse the walk and assign ordinals, buffering all steps.
    let mut walk_steps: Vec<WalkStep> = Vec::new();

    let mut collect_step = |seg_id: &str, orient: &str| {
        let seg_len = seg_lengths.get(seg_id).copied().unwrap_or(0);
        let is_plus = orient == "+";

        let ord = if let Some(&o) = seg_ordinals.get(seg_id) {
            o
        } else {
            let o = *next_ordinal;
            *next_ordinal += 1;
            seg_ordinals.insert(seg_id.to_string(), o);
            o
        };

        if is_ref {
            ref_orients.insert(ord, is_plus);
        }

        walk_steps.push(WalkStep { ord, seg_len, is_plus });
    };

    if is_walk {
        let bytes = seg_str.as_bytes();
        let mut pos = 0;
        while pos < bytes.len() {
            if bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
                continue;
            }
            let orient = if bytes[pos] == b'>' { "+" } else { "-" };
            pos += 1;
            let start = pos;
            while pos < bytes.len() && bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
            }
            collect_step(&seg_str[start..pos], orient);
        }
    } else {
        for step in seg_str.split(',') {
            let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
                (&step[..step.len() - 1], if step.ends_with('+') { "+" } else { "-" })
            } else {
                (step, "+")
            };
            collect_step(seg_id, orient);
        }
    }

    // Phase 2: for non-reference walks, detect if the walk is a
    // reverse-complemented contig. A walk is reverse-complemented iff
    // EVERY segment shared with the reference has opposite orient.
    // This is a deterministic condition, not a heuristic.
    let need_flip = if is_ref || !groom {
        false
    } else {
        // Use bp-weighted tally: tiny 1-2bp SNP nodes in the graph
        // shouldn't prevent detection of a reversed contig.
        let mut shared_bp = 0u64;
        let mut opposite_bp = 0u64;
        for step in &walk_steps {
            if let Some(&ref_is_plus) = ref_orients.get(&step.ord) {
                shared_bp += step.seg_len;
                if step.is_plus != ref_is_plus {
                    opposite_bp += step.seg_len;
                }
            }
        }
        // Flip if >99% of shared bp are opposite orientation.
        shared_bp > 0 && opposite_bp * 100 >= shared_bp * 99
    };

    // Phase 3: emit segments.tsv and pos.bed.gz rows.
    // If the walk needs flipping, reverse the offset direction and
    // invert all orient values.
    let total_len: u64 = walk_steps.iter().map(|s| s.seg_len).sum();
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_ords: Vec<u64> = Vec::new();
    let mut steps: usize = 0;

    for step in &walk_steps {
        let effective_orient = if need_flip {
            if step.is_plus { "-" } else { "+" }
        } else if is_ref {
            if step.is_plus { "+" } else { "-" }
        } else if let Some(&ref_is_plus) = ref_orients.get(&step.ord) {
            if step.is_plus == ref_is_plus { "+" } else { "-" }
        } else {
            if step.is_plus { "+" } else { "-" }
        };

        let emit_offset = if need_flip {
            total_len - offset - step.seg_len
        } else {
            offset
        };

        writeln!(
            segments_w,
            "{}\t{}\t{}\t{}\t{}",
            step.ord, path_index, emit_offset, step.seg_len, effective_orient
        )
        .unwrap();

        chunk_ords.push(step.ord);
        offset += step.seg_len;
        steps += 1;

        if steps >= chunk_size {
            chunk_ords.sort_unstable();
            chunk_ords.dedup();
            let ords_str = encode_ordinal_ranges(&chunk_ords);
            if need_flip {
                let flip_start = total_len - offset;
                let flip_end = total_len - chunk_start;
                writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, flip_start, flip_end, ords_str)
                    .unwrap();
            } else {
                writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                    .unwrap();
            }
            chunk_start = offset;
            chunk_ords.clear();
            steps = 0;
        }
    }

    if steps > 0 {
        chunk_ords.sort_unstable();
        chunk_ords.dedup();
        let ords_str = encode_ordinal_ranges(&chunk_ords);
        if need_flip {
            let flip_start = total_len - offset;
            let flip_end = total_len - chunk_start;
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, flip_start, flip_end, ords_str)
                .unwrap();
        } else {
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                .unwrap();
        }
    }

    if need_flip {
        eprintln!("    flipped: {} (all {} shared segments had opposite orient)", path_name, walk_steps.iter().filter(|s| ref_orients.contains_key(&s.ord)).count());
    }

    total_len
}

fn parse_walk(line: &str) -> Option<(String, String, String, bool)> {
    let parts: Vec<&str> = line.splitn(8, '\t').collect();
    if parts.len() < 7 {
        return None;
    }
    let assembly = format!("{}#{}", parts[1], parts[2]);
    let path_name = format!("{}#{}#{}", parts[1], parts[2], parts[3]);
    Some((path_name, assembly, parts[6].to_string(), true))
}

fn parse_p_line(line: &str) -> Option<(String, String, String, bool)> {
    let parts: Vec<&str> = line.splitn(4, '\t').collect();
    if parts.len() < 3 {
        return None;
    }
    let raw_name = parts[1];
    let (sample, sequence) = match raw_name.rfind('#') {
        Some(idx) => (&raw_name[..idx], &raw_name[idx + 1..]),
        None => (raw_name, raw_name),
    };
    Some((
        format!("{}#{}", sample, sequence),
        sample.to_string(),
        parts[2].to_string(),
        false,
    ))
}

fn write_manifest(path: &str, genomes: &[String], files: &[(String, String)]) {
    let mut out = BufWriter::new(File::create(path).expect("create manifest"));
    write!(out, "{{\n  \"genomes\": [").unwrap();
    for (i, g) in genomes.iter().enumerate() {
        if i > 0 { write!(out, ",").unwrap(); }
        write!(out, "\n    \"{}\"", g).unwrap();
    }
    write!(out, "\n  ],\n  \"files\": {{").unwrap();
    for (i, (genome, prefix)) in files.iter().enumerate() {
        if i > 0 { write!(out, ",").unwrap(); }
        write!(out, "\n    \"{}\": \"{}\"", genome, prefix).unwrap();
    }
    write!(out, "\n  }}\n}}\n").unwrap();
}

fn encode_ordinal_ranges(ords: &[u64]) -> String {
    if ords.is_empty() {
        return String::new();
    }
    let mut parts: Vec<String> = Vec::new();
    let mut run_start = ords[0];
    let mut run_end = ords[0];
    for &o in &ords[1..] {
        if o == run_end + 1 {
            run_end = o;
        } else {
            if run_start == run_end {
                parts.push(run_start.to_string());
            } else {
                parts.push(format!("{}-{}", run_start, run_end));
            }
            run_start = o;
            run_end = o;
        }
    }
    if run_start == run_end {
        parts.push(run_start.to_string());
    } else {
        parts.push(format!("{}-{}", run_start, run_end));
    }
    parts.join(",")
}

fn encode_filename(s: &str) -> String {
    s.replace('#', "_").replace('/', "_")
}

fn output_parent(prefix: &str) -> std::path::PathBuf {
    std::path::Path::new(prefix)
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf()
}

fn open_file(path: &str) -> Box<dyn BufRead> {
    if path.ends_with(".gz") {
        let child = Command::new("gzip")
            .args(["-dc", path])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap_or_else(|_| panic!("failed to open {}", path));
        Box::new(BufReader::with_capacity(1 << 20, child.stdout.unwrap()))
    } else {
        let file = File::open(path).unwrap_or_else(|_| panic!("failed to open {}", path));
        Box::new(BufReader::with_capacity(1 << 20, file))
    }
}

fn spawn_sort_bgzip(output: &str) -> std::process::Child {
    Command::new("sh")
        .args(["-c", &format!("sort -t\"\t\" -k1,1 -k2,2n | bgzip > \"{}\"", output)])
        .env("LC_ALL", "C")
        .stdin(Stdio::piped())
        .spawn()
        .expect("failed to spawn sort|bgzip")
}

fn run_cmd(cmd: &str, args: &[&str]) {
    let status = Command::new(cmd).args(args).status().unwrap_or_else(|_| panic!("failed to run {}", cmd));
    if !status.success() {
        eprintln!("Warning: {} {:?} failed", cmd, args);
    }
}
