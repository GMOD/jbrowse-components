use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};
use std::time::Instant;

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
    input_file: String,

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

    /// Generate binary alignment file (aln.bin + aln.idx) from the GFA.
    /// Requires that the GFA contains actual segment sequences (not '*').
    #[arg(long)]
    aln_bin: bool,

    /// Number of threads for parallel aln generation (default: 1, 0 = all cores)
    #[arg(long, default_value_t = 1)]
    threads: usize,
}

fn main() {
    let cli = Args::parse();

    let gfa_path = &cli.input_file;

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
    let generate_aln_bin = cli.aln_bin;
    let threads = cli.threads;

    // Two-phase single-pass: reads all lines once, collecting S-lines in memory
    // and spilling P/W-lines to a temp file. Then replays the temp file to
    // process paths with full segment knowledge. This supports streaming from
    // stdin (vg convert -f input.vg | gfa-to-tabix - output) without buffering
    // large path walks in memory.
    let tmp_dir = output_parent(&output_prefix).join(format!(".gfa-tmp-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir).expect("failed to create temp dir");

    eprintln!("Reading GFA...");
    let mut seg_lengths: HashMap<String, u64> = HashMap::new();
    let mut seg_sequences: HashMap<String, String> = HashMap::new();
    let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
    let mut next_ordinal: u64 = 0;
    let mut has_sequences = false;

    // Spool P/W-lines to a temp file to avoid buffering in memory
    let paths_tmp = tmp_dir.join("paths.txt");
    let mut paths_tmp_w = BufWriter::new(File::create(&paths_tmp).expect("create paths tmp"));
    let mut path_line_count: u64 = 0;

    for line in open_file(gfa_path).lines() {
        let line = line.expect("read error");

        if line.starts_with("S\t") {
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
            if generate_aln_bin && seq != "*" {
                has_sequences = true;
                seg_sequences.insert(name.clone(), seq.to_string());
            }
            seg_lengths.insert(name, length);
        } else if line.starts_with("W\t") || line.starts_with("P\t") {
            paths_tmp_w.write_all(line.as_bytes()).unwrap();
            paths_tmp_w.write_all(b"\n").unwrap();
            path_line_count += 1;
        }
    }
    drop(paths_tmp_w);

    eprintln!("  {} segments, {} path lines", seg_lengths.len(), path_line_count);
    if generate_aln_bin && !has_sequences {
        eprintln!("Warning: --aln-bin requested but GFA has no segment sequences (all '*'). Skipping aln generation.");
    }

    // Replay buffered path lines now that all segments are known
    eprintln!("Processing paths...");

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
    let mut aln_paths: Vec<AlnPathInfo> = Vec::new();
    let mut ref_orients: HashMap<u64, bool> = HashMap::new();
    let mut ref_assembly: Option<String> = None;
    let mut path_names: Vec<String> = Vec::new();
    let mut path_name_indices: HashMap<String, u64> = HashMap::new();
    let mut path_sizes: Vec<(String, u64)> = Vec::new();
    let mut path_count: u64 = 0;

    for line in BufReader::new(File::open(&paths_tmp).expect("reopen paths tmp")).lines() {
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

            if generate_aln_bin && has_sequences {
                let steps = parse_walk_to_ordinals(
                    &seg_str, is_walk, &seg_ordinals, &seg_lengths,
                );
                aln_paths.push(AlnPathInfo {
                    path_name: path_name.clone(),
                    assembly: assembly.clone(),
                    steps,
                });
            }

            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }
    // Clean up paths temp file
    let _ = fs::remove_file(&paths_tmp);
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

    // Build segments.bin + .idx
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

    if generate_aln_bin && has_sequences {
        eprintln!("Generating binary alignment file...");
        let t_idx = Instant::now();
        // Build ordinal-indexed sequence Vec for O(1) lookup, then let
        // seg_sequences fall out of scope to free the String-keyed HashMap.
        let ord_sequences = {
            let mut seqs: Vec<Vec<u8>> = vec![Vec::new(); next_ordinal as usize];
            for (name, seq) in seg_sequences {
                if let Some(&ord) = seg_ordinals.get(&name) {
                    seqs[ord as usize] = seq.into_bytes().iter().map(|&b| to_lower(b)).collect();
                }
            }
            seqs
        };
        eprintln!("  Built ordinal index ({:.1}s)", t_idx.elapsed().as_secs_f64());
        generate_aln_bin_from_paths_fast(
            &output_prefix,
            &aln_paths,
            &ord_sequences,
            &ref_orients,
            groom,
            threads,
        );
    }

    eprintln!("Done.");
    eprintln!("  Segments: {}", seg_lengths.len());
    eprintln!("  Paths: {}", path_count);
    eprintln!("  Genomes: {} ({})", genomes.len(), genomes.join(", "));
}

/// Sort the unsorted segments TSV by ordinal, then write a flat binary file
/// (.bin) with fixed-width 15-byte records and a companion byte-offset index
/// (.idx).
///
/// Binary record layout (little-endian):
///   segOrd:     u32  (4 bytes)
///   pathNameIdx: u16  (2 bytes)
///   offset:     u32  (4 bytes)
///   segLen:     u32  (4 bytes)
///   orient:     u8   (1 byte, ASCII '+' or '-')
///   Total:      15 bytes per record
///
/// The .idx file is a flat array of little-endian u64 values, one per numeric
/// ID.  idx[N] = byte offset in the binary file where node N's records begin.
///
/// No compression — the viewer reads exact byte ranges via the index, avoiding
/// all BGZF decompression overhead.
const RECORD_SIZE: u64 = 15;

fn sort_and_build_segments(
    unsorted_path: &str,
    _header: &str,
    output_prefix: &str,
    total_ordinals: u64,
    sort_tmp_dir: &str,
) {
    let bin_file = format!("{}.bin", output_prefix);
    let idx_file = format!("{}.idx", output_prefix);

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

    let mut out = BufWriter::new(File::create(&bin_file).expect("create bin"));

    let mut index_offsets: Vec<u64> = Vec::new();
    let mut byte_offset: u64 = 0;
    let mut last_ord: i64 = -1;

    let sort_stdout = sort_proc.stdout.take().unwrap();
    for line in BufReader::new(sort_stdout).lines() {
        let line = line.expect("read sorted line");
        if line.is_empty() {
            continue;
        }

        // Parse TSV: segOrd \t pathNameIdx \t offset \t segLen \t orient
        let mut fields = line.splitn(5, '\t');
        let seg_ord: u64 = fields.next().unwrap().parse().unwrap_or(0);
        let path_name_idx: u16 = fields.next().unwrap().parse().unwrap_or(0);
        let offset: u32 = fields.next().unwrap().parse().unwrap_or(0);
        let seg_len: u32 = fields.next().unwrap().parse().unwrap_or(0);
        let orient: u8 = fields.next().unwrap().as_bytes()[0];

        if seg_ord as i64 != last_ord {
            while (index_offsets.len() as u64) <= seg_ord {
                index_offsets.push(byte_offset);
            }
            last_ord = seg_ord as i64;
        }

        out.write_all(&(seg_ord as u32).to_le_bytes()).unwrap();
        out.write_all(&path_name_idx.to_le_bytes()).unwrap();
        out.write_all(&offset.to_le_bytes()).unwrap();
        out.write_all(&seg_len.to_le_bytes()).unwrap();
        out.write_all(&[orient]).unwrap();

        byte_offset += RECORD_SIZE;
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
    if path == "-" {
        Box::new(BufReader::with_capacity(1 << 20, std::io::stdin()))
    } else if path.ends_with(".gz") {
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

// ── Binary CS encoding ──────────────────────────────────────────────────
//
// Format (high 2 bits of first byte = opcode):
//   Match  (00xxxxxx): low 6 bits = length for 1-63, else 0x00 + LEB128 varint
//   Sub    (01xxRRAA): single byte, bits 3:2 = ref base, bits 1:0 = alt base
//   Ins    (10xxxxxx): low 6 bits = length for 1-63, else 0x80 + LEB128 varint,
//                      followed by ceil(len/4) bytes of 2-bit packed bases
//   Del    (11xxxxxx): same as insertion
//
// Base encoding: A=0, C=1, G=2, T=3

const BCS_MATCH: u8 = 0x00;
const BCS_SUB: u8 = 0x40;
const BCS_INS: u8 = 0x80;
const BCS_DEL: u8 = 0xC0;

fn base_to_2bit(b: u8) -> u8 {
    match b {
        b'A' | b'a' => 0,
        b'C' | b'c' => 1,
        b'G' | b'g' => 2,
        b'T' | b't' => 3,
        _ => 0,
    }
}

fn write_varint(out: &mut Vec<u8>, mut value: u32) {
    while value >= 0x80 {
        out.push((value as u8 & 0x7f) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
}

fn pack_bases(seq: &[u8], out: &mut Vec<u8>) {
    for chunk in seq.chunks(4) {
        let mut byte: u8 = 0;
        for (j, &b) in chunk.iter().enumerate() {
            byte |= base_to_2bit(b) << (6 - j * 2);
        }
        out.push(byte);
    }
}

// ── aln.bin / aln.idx format ─────────────────────────────────────────────
//
// aln.bin: sorted binary records (by chrom, refStart)
//   Per record:
//     refStart:       u32 (4)
//     refEnd:         u32 (4)
//     queryGenomeIdx: u16 (2)
//     mateChromIdx:   u16 (2)
//     mateStart:      u32 (4)
//     mateEnd:        u32 (4)
//     strand:         u8  (1, 0x2B='+' or 0x2D='-')
//     identity:       u16 (2, identity * 10000)
//     csLen:          u16 (2)
//     csData:         [u8; csLen]
//
// aln.idx: index header + per-chrom linear index
//   Header:
//     magic:      4 bytes "ALNI"
//     version:    u8
//     numGenomes: u16
//     genome names: [u16 len, UTF-8 bytes] × numGenomes
//     numChroms:  u16
//     chrom names: [u16 len, UTF-8 bytes] × numChroms
//   Per chrom:
//     chromIdx:   u16
//     chromLen:   u32 (bp)
//     numBins:    u32 (ceil(chromLen / BIN_SIZE))
//     binOffsets: [u64] × (numBins + 1)

const BIN_SIZE: u32 = 16384;
const ALN_RECORD_FIXED: usize = 25;

struct AlnRecord {
    ref_start: u32,
    ref_end: u32,
    query_genome_idx: u16,
    mate_chrom_idx: u16,
    mate_start: u32,
    mate_end: u32,
    strand: u8,
    identity: u16,
    cs_data: Vec<u8>,
}

impl AlnRecord {
    fn write_to(&self, w: &mut impl Write) {
        w.write_all(&self.ref_start.to_le_bytes()).unwrap();
        w.write_all(&self.ref_end.to_le_bytes()).unwrap();
        w.write_all(&self.query_genome_idx.to_le_bytes()).unwrap();
        w.write_all(&self.mate_chrom_idx.to_le_bytes()).unwrap();
        w.write_all(&self.mate_start.to_le_bytes()).unwrap();
        w.write_all(&self.mate_end.to_le_bytes()).unwrap();
        w.write_all(&[self.strand]).unwrap();
        w.write_all(&self.identity.to_le_bytes()).unwrap();
        w.write_all(&(self.cs_data.len() as u16).to_le_bytes()).unwrap();
        w.write_all(&self.cs_data).unwrap();
    }

    fn byte_len(&self) -> usize {
        ALN_RECORD_FIXED + self.cs_data.len()
    }
}

fn write_length_prefixed_string(w: &mut impl Write, s: &str) {
    let bytes = s.as_bytes();
    w.write_all(&(bytes.len() as u16).to_le_bytes()).unwrap();
    w.write_all(bytes).unwrap();
}

// ── Generate aln.bin directly from GFA path walks ────────────────────────

// Parse a walk/path string directly into ordinal tuples, avoiding
// intermediate String allocations for segment names.
fn parse_walk_to_ordinals(
    seg_str: &str,
    is_walk: bool,
    seg_ordinals: &HashMap<String, u64>,
    seg_lengths: &HashMap<String, u64>,
) -> Vec<(u64, bool, u64)> {
    let mut steps = Vec::new();
    if is_walk {
        let bytes = seg_str.as_bytes();
        let mut pos = 0;
        while pos < bytes.len() {
            if bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
                continue;
            }
            let orient = bytes[pos] == b'>';
            pos += 1;
            let start = pos;
            while pos < bytes.len() && bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
            }
            let name = &seg_str[start..pos];
            let ord = seg_ordinals.get(name).copied().unwrap_or(0);
            let len = seg_lengths.get(name).copied().unwrap_or(0);
            steps.push((ord, orient, len));
        }
    } else {
        for step in seg_str.split(',') {
            let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
                (&step[..step.len() - 1], step.ends_with('+'))
            } else {
                (step, true)
            };
            let ord = seg_ordinals.get(seg_id).copied().unwrap_or(0);
            let len = seg_lengths.get(seg_id).copied().unwrap_or(0);
            steps.push((ord, orient, len));
        }
    }
    steps
}

fn complement_byte(b: u8) -> u8 {
    match b {
        b'A' | b'a' => b't',
        b'C' | b'c' => b'g',
        b'G' | b'g' => b'c',
        b'T' | b't' => b'a',
        _ => b,
    }
}

fn to_lower(b: u8) -> u8 {
    if b >= b'A' && b <= b'Z' { b + 32 } else { b }
}

// Compare two byte sequences and produce binary CS directly,
// avoiding intermediate text CS string entirely.
fn compute_binary_cs_from_bytes(ref_seq: &[u8], query_seq: &[u8]) -> Vec<u8> {
    let min_len = ref_seq.len().min(query_seq.len());
    let mut out: Vec<u8> = Vec::new();

    let mut match_run = 0u32;
    for i in 0..min_len {
        if ref_seq[i] == query_seq[i] {
            match_run += 1;
        } else {
            if match_run > 0 {
                if match_run <= 63 {
                    out.push(BCS_MATCH | match_run as u8);
                } else {
                    out.push(BCS_MATCH);
                    write_varint(&mut out, match_run);
                }
                match_run = 0;
            }
            let ref_base = base_to_2bit(ref_seq[i]);
            let alt_base = base_to_2bit(query_seq[i]);
            out.push(BCS_SUB | (ref_base << 2) | alt_base);
        }
    }
    if match_run > 0 {
        if match_run <= 63 {
            out.push(BCS_MATCH | match_run as u8);
        } else {
            out.push(BCS_MATCH);
            write_varint(&mut out, match_run);
        }
    }

    if ref_seq.len() > min_len {
        encode_indel(&mut out, BCS_DEL, &ref_seq[min_len..]);
    } else if query_seq.len() > min_len {
        encode_indel(&mut out, BCS_INS, &query_seq[min_len..]);
    }

    out
}

fn compute_identity_from_binary_cs(data: &[u8]) -> f64 {
    let mut match_bp: u64 = 0;
    let mut mismatch_bp: u64 = 0;
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        let op = byte & 0xC0;
        if op == BCS_MATCH {
            let len_bits = byte & 0x3F;
            i += 1;
            if len_bits == 0 {
                let mut value: u32 = 0;
                let mut shift = 0;
                while i < data.len() {
                    let b = data[i];
                    value |= ((b & 0x7f) as u32) << shift;
                    i += 1;
                    if b & 0x80 == 0 { break; }
                    shift += 7;
                }
                match_bp += value as u64;
            } else {
                match_bp += len_bits as u64;
            }
        } else if op == BCS_SUB {
            mismatch_bp += 1;
            i += 1;
        } else {
            // INS or DEL
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                let mut value: u32 = 0;
                let mut shift = 0;
                while i < data.len() {
                    let b = data[i];
                    value |= ((b & 0x7f) as u32) << shift;
                    i += 1;
                    if b & 0x80 == 0 { break; }
                    shift += 7;
                }
                value
            } else {
                len_bits as u32
            };
            i += ((len + 3) / 4) as usize;
        }
    }
    let total = match_bp + mismatch_bp;
    if total > 0 { match_bp as f64 / total as f64 } else { 1.0 }
}

struct AlnPathInfo {
    path_name: String,
    assembly: String,
    steps: Vec<(u64, bool, u64)>, // (ordinal, orient, seg_len)
}

fn flush_block_bin(records: &mut Vec<(u16, AlnRecord)>,
                   ref_chrom_idx: u16, query_genome_idx: u16, query_chrom_idx: u16,
                   start_ref: u64, end_ref: u64, start_query: u64, end_query: u64,
                   strand: i8, cs_data: &[u8]) {
    if cs_data.is_empty() { return; }
    let identity = compute_identity_from_binary_cs(cs_data);
    records.push((ref_chrom_idx, AlnRecord {
        ref_start: start_ref as u32, ref_end: end_ref as u32,
        query_genome_idx, mate_chrom_idx: query_chrom_idx,
        mate_start: start_query as u32, mate_end: end_query as u32,
        strand: if strand < 0 { b'-' } else { b'+' },
        identity: (identity * 10000.0).round() as u16,
        cs_data: cs_data.to_vec(),
    }));
}

// Fast version using ordinal-indexed Vecs instead of String-keyed HashMaps.
// Steps are pre-parsed as (ordinal, orient, seg_len) tuples.
// Forward-orient: sequences are already lowercased, just copy.
// Reverse complement: reverse and complement each byte.
fn fill_seg_sequence_by_ord(
    ord: u64,
    orient: bool,
    ord_sequences: &[Vec<u8>],
    buf: &mut Vec<u8>,
) {
    buf.clear();
    let seq = &ord_sequences[ord as usize];
    if orient {
        buf.extend_from_slice(seq); // already lowercased
    } else {
        buf.extend(seq.iter().rev().map(|&b| complement_byte(b)));
    }
}

fn encode_indel(cs: &mut Vec<u8>, op: u8, seq: &[u8]) {
    let len = seq.len() as u32;
    if len <= 63 { cs.push(op | len as u8); }
    else { cs.push(op); write_varint(cs, len); }
    pack_bases(seq, cs);
}

fn encode_bubble_cs(ref_seq: &[u8], query_seq: &[u8], cs: &mut Vec<u8>) {
    if !ref_seq.is_empty() && !query_seq.is_empty() {
        cs.extend_from_slice(&compute_binary_cs_from_bytes(ref_seq, query_seq));
    } else if !ref_seq.is_empty() {
        encode_indel(cs, BCS_DEL, ref_seq);
    } else if !query_seq.is_empty() {
        encode_indel(cs, BCS_INS, query_seq);
    }
}

fn emit_match_bin(cs: &mut Vec<u8>, len: u64) {
    if len > 0 && len <= 63 { cs.push(BCS_MATCH | len as u8); }
    else if len > 0 { cs.push(BCS_MATCH); write_varint(cs, len as u32); }
}

// Process a single (ref_path, query_path) pair into alignment records.
fn process_path_pair(
    ref_path: &AlnPathInfo,
    ref_by_ord: &[Option<(u32, u64)>], // ordinal → (ref_step_index, ref_offset)
    query_path: &AlnPathInfo,
    ref_chrom_idx: u16,
    query_genome_idx: u16,
    query_chrom_idx: u16,
    ref_orients: &HashMap<u64, bool>,
    ord_sequences: &[Vec<u8>],
    groom: bool,
) -> Vec<(u16, AlnRecord)> {
    let query_steps = &query_path.steps;
    let mut records: Vec<(u16, AlnRecord)> = Vec::new();

    // Detect grooming need
    let need_flip = if !groom {
        false
    } else {
        let mut shared_bp = 0u64;
        let mut opposite_bp = 0u64;
        for &(ord, orient, seg_len) in query_steps {
            if let Some(&ref_is_plus) = ref_orients.get(&ord) {
                shared_bp += seg_len;
                if orient != ref_is_plus { opposite_bp += seg_len; }
            }
        }
        shared_bp > 0 && opposite_bp * 100 >= shared_bp * 99
    };

    // Pre-compute cumulative offset array
    let mut query_offsets: Vec<u64> = Vec::with_capacity(query_steps.len() + 1);
    query_offsets.push(0);
    let mut cumul: u64 = 0;
    for &(_ord, _orient, seg_len) in query_steps {
        cumul += seg_len;
        query_offsets.push(cumul);
    }
    let query_total_len = cumul;

    // Find shared segments (anchors) using Vec-indexed lookup
    struct Anchor { ref_idx: u32, query_idx: u32, ref_offset: u64, seg_len: u64, same_strand: bool }
    let mut anchors: Vec<Anchor> = Vec::new();
    for (qi, &(ord, orient, seg_len)) in query_steps.iter().enumerate() {
        if let Some(&Some((ri, r_off))) = ref_by_ord.get(ord as usize) {
            let ref_orient = ref_path.steps[ri as usize].1;
            let effective_orient = if need_flip { !orient } else { orient };
            anchors.push(Anchor {
                ref_idx: ri, query_idx: qi as u32, ref_offset: r_off,
                seg_len, same_strand: effective_orient == ref_orient,
            });
        }
    }
    anchors.sort_unstable_by_key(|a| a.ref_offset);

    // Merge anchors into alignment blocks with binary CS.
    // A block breaks on strand change or coordinate overlap/out-of-order.
    // Between consecutive same-strand anchors, bubble sequences (segments
    // traversed by one path but not the other) produce CS indels/mismatches.
    struct Block {
        ref_start: u64,
        ref_end: u64,
        query_start: u64,
        query_end: u64,
        strand: i8,
        prev_ref_idx: u32,
        prev_query_idx: u32,
        cs: Vec<u8>,
    }

    let mut block: Option<Block> = None;
    let mut ref_bubble_buf: Vec<u8> = Vec::new();
    let mut query_bubble_buf: Vec<u8> = Vec::new();
    let mut seg_buf: Vec<u8> = Vec::new();

    let mut flush = |blk: &Block| {
        flush_block_bin(
            &mut records, ref_chrom_idx, query_genome_idx, query_chrom_idx,
            blk.ref_start, blk.ref_end, blk.query_start, blk.query_end,
            blk.strand, &blk.cs,
        );
    };

    for anchor in &anchors {
        let strand: i8 = if anchor.same_strand { 1 } else { -1 };
        let mut q_off = query_offsets[anchor.query_idx as usize];
        if need_flip { q_off = query_total_len - q_off - anchor.seg_len; }
        let q_end = q_off + anchor.seg_len;

        let should_break = match &block {
            None => true,
            Some(blk) => {
                if strand != blk.strand { true }
                else {
                    let ref_gap = anchor.ref_offset as i64 - blk.ref_end as i64;
                    let query_gap = q_off as i64 - blk.query_end as i64;
                    ref_gap < 0 || query_gap < 0
                }
            }
        };

        if should_break {
            if let Some(blk) = block.take() { flush(&blk); }
            let mut cs = Vec::new();
            emit_match_bin(&mut cs, anchor.seg_len);
            block = Some(Block {
                ref_start: anchor.ref_offset, ref_end: anchor.ref_offset + anchor.seg_len,
                query_start: q_off, query_end: q_end, strand,
                prev_ref_idx: anchor.ref_idx, prev_query_idx: anchor.query_idx,
                cs,
            });
            continue;
        }

        let blk = block.as_mut().unwrap();

        // Encode bubble between previous anchor and this one
        let ref_gap = anchor.ref_offset as i64 - blk.ref_end as i64;
        let query_gap = q_off as i64 - blk.query_end as i64;
        if ref_gap > 0 || query_gap > 0 {
            ref_bubble_buf.clear();
            for ri in (blk.prev_ref_idx as usize + 1)..anchor.ref_idx as usize {
                let (ord, orient, _) = ref_path.steps[ri];
                fill_seg_sequence_by_ord(ord, orient, ord_sequences, &mut seg_buf);
                ref_bubble_buf.extend_from_slice(&seg_buf);
            }
            query_bubble_buf.clear();
            for qi in (blk.prev_query_idx as usize + 1)..anchor.query_idx as usize {
                let (ord, orient, _) = query_steps[qi];
                let eff = if need_flip { !orient } else { orient };
                fill_seg_sequence_by_ord(ord, eff, ord_sequences, &mut seg_buf);
                query_bubble_buf.extend_from_slice(&seg_buf);
            }
            encode_bubble_cs(&ref_bubble_buf, &query_bubble_buf, &mut blk.cs);
        }

        emit_match_bin(&mut blk.cs, anchor.seg_len);
        blk.ref_end = anchor.ref_offset + anchor.seg_len;
        blk.query_end = q_end;
        blk.prev_ref_idx = anchor.ref_idx;
        blk.prev_query_idx = anchor.query_idx;
    }

    if let Some(blk) = block.take() { flush(&blk); }

    records
}

fn generate_aln_bin_from_paths_fast(
    output_prefix: &str,
    aln_paths: &[AlnPathInfo],
    ord_sequences: &[Vec<u8>],
    ref_orients: &HashMap<u64, bool>,
    groom: bool,
    threads: usize,
) {
    use rayon::prelude::*;

    let t_start = Instant::now();

    // Configure rayon thread pool
    if threads != 1 {
        let num_threads = if threads == 0 { rayon::current_num_threads() } else { threads };
        rayon::ThreadPoolBuilder::new()
            .num_threads(num_threads)
            .build_global()
            .ok(); // ignore error if already initialized
        eprintln!("  Using {} threads", num_threads);
    }

    // Group paths by assembly
    let mut assembly_paths: HashMap<String, Vec<usize>> = HashMap::new();
    for (i, p) in aln_paths.iter().enumerate() {
        assembly_paths.entry(p.assembly.clone()).or_default().push(i);
    }

    // Collect genome and chrom names
    let mut genome_names: Vec<String> = Vec::new();
    let mut genome_map: HashMap<String, u16> = HashMap::new();
    let mut chrom_names: Vec<String> = Vec::new();
    let mut chrom_map: HashMap<String, u16> = HashMap::new();

    for p in aln_paths {
        if !genome_map.contains_key(&p.assembly) {
            let idx = genome_names.len() as u16;
            genome_map.insert(p.assembly.clone(), idx);
            genome_names.push(p.assembly.clone());
        }
        if !chrom_map.contains_key(&p.path_name) {
            let idx = chrom_names.len() as u16;
            chrom_map.insert(p.path_name.clone(), idx);
            chrom_names.push(p.path_name.clone());
        }
    }

    // Bidirectional: every assembly takes a turn as "reference" so records
    // are queryable from any genome's coordinate space.
    let assembly_names: Vec<String> = assembly_paths.keys().cloned().collect();
    eprintln!("  Bidirectional mode: {} assemblies, each will be reference in turn", assembly_names.len());

    // Build work items: (ref_by_ord_idx, query_path_idx, ref_chrom_idx, query_genome_idx, query_chrom_idx)
    let mut work_items: Vec<(usize, usize, u16, u16, u16)> = Vec::new();
    let mut ref_by_ord_vecs: Vec<(usize, Vec<Option<(u32, u64)>>)> = Vec::new();

    for ref_asm in &assembly_names {
        let ref_path_indices = &assembly_paths[ref_asm];
        let ref_genome_idx = genome_map[ref_asm];

        for &ref_pi in ref_path_indices {
            let ref_path = &aln_paths[ref_pi];
            let ref_chrom_idx = chrom_map[&ref_path.path_name];

            let max_ord = ref_path.steps.iter().map(|&(ord, _, _)| ord).max().unwrap_or(0) as usize;
            let mut ref_by_ord: Vec<Option<(u32, u64)>> = vec![None; max_ord + 1];
            let mut ref_offset: u64 = 0;
            for (i, &(ord, _orient, seg_len)) in ref_path.steps.iter().enumerate() {
                ref_by_ord[ord as usize] = Some((i as u32, ref_offset));
                ref_offset += seg_len;
            }

            let ref_ord_idx = ref_by_ord_vecs.len();
            ref_by_ord_vecs.push((ref_pi, ref_by_ord));

            for (query_asm, query_indices) in &assembly_paths {
                if query_asm == ref_asm { continue; }
                let query_genome_idx = genome_map[query_asm];
                for &query_pi in query_indices {
                    let query_chrom_idx = chrom_map[&aln_paths[query_pi].path_name];
                    work_items.push((ref_ord_idx, query_pi, ref_chrom_idx, query_genome_idx, query_chrom_idx));
                }
            }
        }

        let _ = ref_genome_idx; // used implicitly via genome_map
    }

    eprintln!("  {} work items (path pairs)", work_items.len());

    // Process work items — parallel if threads > 1, sequential otherwise
    let all_records: Vec<(u16, AlnRecord)> = if threads == 1 {
        work_items.iter().flat_map(|&(ref_ord_idx, query_pi, ref_chrom_idx, query_genome_idx, query_chrom_idx)| {
            let (ref_pi, ref_by_ord) = &ref_by_ord_vecs[ref_ord_idx];
            process_path_pair(
                &aln_paths[*ref_pi], ref_by_ord, &aln_paths[query_pi],
                ref_chrom_idx, query_genome_idx, query_chrom_idx,
                ref_orients, ord_sequences, groom,
            )
        }).collect()
    } else {
        work_items.par_iter().flat_map(|&(ref_ord_idx, query_pi, ref_chrom_idx, query_genome_idx, query_chrom_idx)| {
            let (ref_pi, ref_by_ord) = &ref_by_ord_vecs[ref_ord_idx];
            process_path_pair(
                &aln_paths[*ref_pi], ref_by_ord, &aln_paths[query_pi],
                ref_chrom_idx, query_genome_idx, query_chrom_idx,
                ref_orients, ord_sequences, groom,
            )
        }).collect()
    };

    let num_pairs = assembly_names.len() * (assembly_names.len() - 1);
    eprintln!("  {} alignment records from {} assembly pairs ({:.1}s)", all_records.len(), num_pairs, t_start.elapsed().as_secs_f64());

    let mut all_records = all_records;
    all_records.sort_unstable_by(|a, b| a.0.cmp(&b.0).then(a.1.ref_start.cmp(&b.1.ref_start)));
    write_aln_bin_and_idx(output_prefix, &all_records, &genome_names, &chrom_names);
}

fn write_aln_bin_and_idx(
    output_prefix: &str,
    records: &[(u16, AlnRecord)],
    genome_names: &[String],
    chrom_names: &[String],
) {
    let bin_path = format!("{}.aln.bin", output_prefix);
    let idx_path = format!("{}.aln.idx", output_prefix);

    // Write records to aln.bin, tracking per-chrom bin offsets
    let mut bin_out = BufWriter::new(File::create(&bin_path).expect("create aln.bin"));
    let mut byte_offset: u64 = 0;
    let mut chrom_max_end: HashMap<u16, u32> = HashMap::new();
    let mut chrom_bin_offsets: HashMap<u16, Vec<(u32, u64)>> = HashMap::new();

    for (ci, rec) in records {
        let bin_idx = rec.ref_start / BIN_SIZE;
        chrom_bin_offsets.entry(*ci).or_default().push((bin_idx, byte_offset));
        let end = chrom_max_end.entry(*ci).or_insert(0);
        if rec.ref_end > *end { *end = rec.ref_end; }
        rec.write_to(&mut bin_out);
        byte_offset += rec.byte_len() as u64;
    }
    drop(bin_out);
    let total_bytes = byte_offset;

    // Write aln.idx: header + per-chrom linear index
    let mut idx_out = BufWriter::new(File::create(&idx_path).expect("create aln.idx"));
    idx_out.write_all(b"ALNI").unwrap();
    idx_out.write_all(&[1u8]).unwrap();

    idx_out.write_all(&(genome_names.len() as u16).to_le_bytes()).unwrap();
    for name in genome_names { write_length_prefixed_string(&mut idx_out, name); }
    idx_out.write_all(&(chrom_names.len() as u16).to_le_bytes()).unwrap();
    for name in chrom_names { write_length_prefixed_string(&mut idx_out, name); }

    for ci in 0..chrom_names.len() as u16 {
        let chrom_len = chrom_max_end.get(&ci).copied().unwrap_or(0);
        let num_bins = if chrom_len > 0 { (chrom_len + BIN_SIZE - 1) / BIN_SIZE } else { 0 };
        idx_out.write_all(&ci.to_le_bytes()).unwrap();
        idx_out.write_all(&chrom_len.to_le_bytes()).unwrap();
        idx_out.write_all(&num_bins.to_le_bytes()).unwrap();

        // Linear index: binOffsets[i] = byte offset of first record in 16kb bin i.
        // Forward-fill empty bins so range queries always find a valid start.
        let mut offsets = vec![total_bytes; (num_bins + 1) as usize];
        if let Some(entries) = chrom_bin_offsets.get(&ci) {
            for &(bin_idx, off) in entries {
                if (bin_idx as usize) < offsets.len() {
                    if off < offsets[bin_idx as usize] { offsets[bin_idx as usize] = off; }
                }
            }
            let mut min_so_far = total_bytes;
            for i in (0..offsets.len()).rev() {
                if offsets[i] < min_so_far { min_so_far = offsets[i]; }
                offsets[i] = min_so_far;
            }
        }
        for off in &offsets { idx_out.write_all(&off.to_le_bytes()).unwrap(); }
    }
    drop(idx_out);

    eprintln!("  Wrote {} ({} bytes)", bin_path, total_bytes);
    eprintln!("  Wrote {}", idx_path);
}

