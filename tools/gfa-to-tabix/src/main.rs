use std::collections::{HashMap, HashSet};
use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 || args.iter().any(|a| a == "-h" || a == "--help") {
        eprintln!(
            "Usage: gfa-to-tabix <gfa-file> [output-prefix] [--chunk-size N] [--assemblies a,b,c] [--sharded]"
        );
        eprintln!("Converts GFA to tabix-indexed pos.bed.gz + segments.gz files.");
        eprintln!("Streaming two-pass approach: O(segments) memory.");
        std::process::exit(if args.len() < 2 { 1 } else { 0 });
    }

    let gfa_path = &args[1];
    let output_prefix = if args.len() > 2 && !args[2].starts_with('-') {
        args[2].clone()
    } else {
        gfa_path
            .trim_end_matches(".gz")
            .trim_end_matches(".gfa")
            .to_string()
    };

    let mut chunk_size: usize = 100;
    let mut assemblies_filter: Option<HashSet<String>> = None;
    let mut sharded = false;

    let mut i = 2;
    while i < args.len() {
        match args[i].as_str() {
            "--chunk-size" if i + 1 < args.len() => {
                chunk_size = args[i + 1].parse().expect("Invalid chunk-size");
                i += 2;
            }
            "--assemblies" if i + 1 < args.len() => {
                assemblies_filter =
                    Some(args[i + 1].split(',').map(|s| s.to_string()).collect());
                i += 2;
            }
            "--sharded" => {
                sharded = true;
                i += 1;
            }
            _ => i += 1,
        }
    }

    // Pass 1: segment lengths and ordinals
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

        if !seg_ordinals.contains_key(&name) {
            seg_ordinals.insert(name.clone(), next_ordinal);
            next_ordinal += 1;
        }
        seg_lengths.insert(name, length);
    }
    eprintln!("  {} segments", seg_lengths.len());

    // Pass 2: stream pos.bed.gz + segments rows to temp files
    eprintln!("Pass 2: Processing paths...");

    let tmp_dir = output_parent(&output_prefix).join(format!(".gfa-tmp-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir).expect("failed to create temp dir");

    let pos_file = format!("{}.pos.bed.gz", output_prefix);
    let mut pos_proc = spawn_sort_bgzip(&pos_file);
    let mut pos_w = BufWriter::new(pos_proc.stdin.take().unwrap());

    let combined_tmp = tmp_dir.join("segs.tsv");
    let mut segs_files: HashMap<String, BufWriter<File>> = HashMap::new();
    if !sharded {
        segs_files.insert(
            String::new(),
            BufWriter::new(File::create(&combined_tmp).expect("create temp")),
        );
    }

    let mut genomes: Vec<String> = Vec::new();
    let mut genome_set: HashSet<String> = HashSet::new();
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

            let segs_key = if sharded { assembly.clone() } else { String::new() };
            if !segs_files.contains_key(&segs_key) {
                let p = tmp_dir.join(format!("{}.tsv", encode_filename(&assembly)));
                segs_files.insert(
                    segs_key.clone(),
                    BufWriter::new(File::create(&p).expect("create shard temp")),
                );
            }
            let segs_w = segs_files.get_mut(&segs_key).unwrap();

            let total = emit_path_rows(
                &path_name,
                &seg_str,
                is_walk,
                chunk_size,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut pos_w,
                segs_w,
            );

            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }

    // Headers
    let header = format!("#genomes={}\n", genomes.join(","));
    let sizes_str: Vec<String> = path_sizes
        .iter()
        .map(|(n, s)| format!("{}:{}", n, s))
        .collect();
    let sizes_header = format!("#sizes={}\n", sizes_str.join(","));
    let full_header = format!("{}{}", header, sizes_header);

    // Finish pos.bed.gz
    pos_w.write_all(header.as_bytes()).unwrap();
    pos_w.write_all(sizes_header.as_bytes()).unwrap();
    drop(pos_w);
    assert!(
        pos_proc.wait().map(|s| s.success()).unwrap_or(false),
        "pos sort|bgzip failed"
    );
    run_cmd("tabix", &["-c", "#", "-p", "bed", &pos_file]);

    // Flush segment temp files
    drop(segs_files);

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

/// Sort an unsorted segments TSV, build the companion byte-offset index,
/// and pipe directly to `bgzip -i` to produce .gz + .gzi in one step.
/// Disk: only the unsorted input + final compressed output (no sorted intermediate).
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

fn emit_path_rows(
    path_name: &str,
    seg_str: &str,
    is_walk: bool,
    chunk_size: usize,
    seg_lengths: &HashMap<String, u64>,
    seg_ordinals: &mut HashMap<String, u64>,
    next_ordinal: &mut u64,
    pos_w: &mut BufWriter<impl Write>,
    segs_w: &mut BufWriter<File>,
) -> u64 {
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_min: u64 = u64::MAX;
    let mut chunk_max: u64 = 0;
    let mut steps: usize = 0;

    let mut emit_step = |seg_id: &str, orient: &str| {
        let seg_len = seg_lengths.get(seg_id).copied().unwrap_or(0);
        let ord = if let Some(&o) = seg_ordinals.get(seg_id) {
            o
        } else {
            let o = *next_ordinal;
            *next_ordinal += 1;
            seg_ordinals.insert(seg_id.to_string(), o);
            o
        };

        writeln!(
            segs_w,
            "{}\t{}\t{}\t{}\t{}\t{}",
            ord, path_name, offset, seg_len, orient, seg_id
        )
        .unwrap();

        chunk_min = chunk_min.min(ord);
        chunk_max = chunk_max.max(ord);
        offset += seg_len;
        steps += 1;

        if steps >= chunk_size {
            writeln!(
                pos_w,
                "{}\t{}\t{}\t{}\t{}",
                path_name, chunk_start, offset, chunk_min, chunk_max
            )
            .unwrap();
            chunk_start = offset;
            chunk_min = u64::MAX;
            chunk_max = 0;
            steps = 0;
        }
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
            emit_step(&seg_str[start..pos], orient);
        }
    } else {
        for step in seg_str.split(',') {
            let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
                (&step[..step.len() - 1], if step.ends_with('+') { "+" } else { "-" })
            } else {
                (step, "+")
            };
            emit_step(seg_id, orient);
        }
    }

    if steps > 0 {
        writeln!(
            pos_w,
            "{}\t{}\t{}\t{}\t{}",
            path_name, chunk_start, offset, chunk_min, chunk_max
        )
        .unwrap();
    }

    offset
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
