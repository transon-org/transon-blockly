// Codec runtime (AD-008, AD-030, AD-032, FR-119/124/126).
//
// `encode` turns a Transon document into Blockly workspace-serialization JSON; `decode` is
// its structural inverse. Both are *executions of the committed codec artifacts* through a
// host-provided engine (two-pass generate-then-run): this module bundles no engine and
// contains no codec↔workspace mapping — it hands the artifact + data to `EngineProvider`
// and returns the result verbatim (FR-126, AD-032).

import type { EngineProvider, Json } from '../engine/ports.js';
import type { JsonPathBlockMap, JsonPathBlockMapEntry } from './vocabulary.js';
import { DOC_MARKER_PLACEHOLDER } from './vocabulary.js';
import encoderArtifact from './artifacts/encoder.json' with { type: 'json' };
import decoderArtifact from './artifacts/decoder.json' with { type: 'json' };
import blockmapArtifact from './artifacts/blockmap.json' with { type: 'json' };

/** The marker the generated `$`-codec executes under. The M1 prototype targets the default
 *  Transon marker `$`; a configurable document marker (FR-063/123) lands with the marker-escape
 *  slice. */
export const CODEC_MARKER = '$';

/**
 * The codec's `include`-recursion ceiling (metadata-contract §6.5, SPEC §16.4, AD-035/RFC-004).
 * The codec walks the document by self-`include`; that recursion is host-stack-bound. Opening
 * every committed codec generator and artifact (AC-042) requires clearing `G_encode`, whose
 * rule-dense walk needs include depth 52 and peaks at ~1113 Python frames (measured, engine
 * 0.1.7) — above CPython's default 1000-frame recursion limit. The ceiling therefore comes with
 * TWO host-side prerequisites, both enforced as data/contract (never bundled, AD-008):
 *   - engine ≥ CODEC_ENGINE_FLOOR (declared below; subsumes the R-32 ≥ 0.1.7 per-level
 *     recursion budget), pinned by `metadata-snapshot.json` + the parity gate;
 *   - the reference hosts raise the interpreter recursion limit to HOST_RECURSION_LIMIT = 1400
 *     (Node `runner.py`; Pyodide glue — browser-verified), giving ~290 frames of headroom over
 *     the deepest committed file while the literal-nesting wall (~68 at 1400) stays ABOVE this
 *     ceiling, so ordinary deep nesting still trips the engine's clean depth-limit guard first.
 * Past the ceiling: the guard's `TransformationError` ("depth limit") — or, for a pathological
 * rule-per-level document, a host recursion overflow caught at the `EngineProvider` boundary —
 * both map to `runtime_transformation`, never `import_unsupported` (§16.4, AD-035).
 */
export const CODEC_MAX_INCLUDE_DEPTH = 55;

/**
 * The codec engine floor (SPEC §7.19/FR-142, NFR-051, AD-037): the minimum host engine whose
 * rule/operator/function surface the COMMITTED codec artifacts require. Engine **0.1.8**
 * introduced the total `in` membership operator and the `length` function, which every
 * structural predicate in the codec now uses (AD-037 — the value-sentinel idiom is retired).
 * Declared exactly once; the session-init check (FR-142) compares the host's reported version
 * against it and surfaces the persistent `engine_floor` diagnostic (§16.4) below it. The FR-140
 * metadata gate cannot subsume this: engine 0.1.7 advertises the same metadata major while
 * lacking the primitives.
 */
export const CODEC_ENGINE_FLOOR = '0.1.8';

/**
 * FR-142: is a host-reported engine version strictly BELOW the codec engine floor?
 * Total and never-throwing: parses a dotted-numeric version (optional `v` prefix) that is
 * either the whole string or followed by a standard pre-release/build separator (`-`/`+`,
 * e.g. `0.1.8-rc1`), and compares numerically with implicit-zero padding. Anything else —
 * absent, empty, or carrying trailing junk (`0.1.7garbage`, `0.1.7.unknown`) — is treated as
 * UNKNOWN and is **never** below the floor (SPEC §7.19: no diagnostic on unknown; a junk
 * suffix must not smuggle a below-floor verdict in on the digits it happens to start with).
 */
export function isBelowEngineFloor(
  version: string | null | undefined,
  floor: string = CODEC_ENGINE_FLOOR,
): boolean {
  const parse = (v: string): number[] | null => {
    const digits = /^v?(\d+(?:\.\d+)*)(?=[-+]|$)/.exec(v.trim())?.[1];
    return digits ? digits.split('.').map(Number) : null;
  };
  const a = version ? parse(version) : null;
  const b = parse(floor);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

interface Artifact {
  entry: string;
  fragments: Record<string, Json>;
}

/**
 * A session's codec artifact set — the three engine-executed codec templates as one bundle
 * (RFC-007 P-C, AD-036). `encode`/`decode`/`blockMap` default to the COMMITTED artifacts; a
 * session on the runtime metadata source (SPEC §7.18, FR-139) passes its freshly generated set
 * instead. Always swap the whole bundle: the three artifacts must come from one catalog —
 * never mix sources (FR-140).
 */
export interface CodecArtifacts {
  encoder: { entry: string; fragments: Record<string, Json> };
  decoder: { entry: string; fragments: Record<string, Json> };
  blockmap: { entry: string; fragments: Record<string, Json> };
}

const ENCODER = encoderArtifact as unknown as Artifact;
const DECODER = decoderArtifact as unknown as Artifact;
const BLOCKMAP = blockmapArtifact as unknown as Artifact;

/** The block-map encoder emits a nested tree of {seg, rule_name?, parameter_name?, children}; the
 *  runtime assembles the flat JsonPathBlockMap (§9.12), building each node's unique, escaped JSON
 *  path (`block_id`/`template_path`) and `nearest_parent_block_id` (FR-094) from the tree. This
 *  reads the map encoder's own output, not workspace blocks, so it is not a codec↔workspace
 *  mapping (FR-126). */
interface MapNode {
  seg?: string | number;
  rule_name?: string;
  parameter_name?: string;
  children: MapNode[];
}
/** Escape a path segment so the `/`-joined path is unambiguous even for keys containing `/` or
 *  `~` (JSON Pointer / RFC 6901): `~` → `~0`, `/` → `~1`. */
function escapeSegment(seg: string | number): string {
  return String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
}
function flattenBlockMap(node: MapNode, parentPath: string | null): JsonPathBlockMapEntry[] {
  const path = parentPath === null ? '$' : `${parentPath}/${escapeSegment(node.seg ?? '')}`;
  const entry: JsonPathBlockMapEntry = { template_path: path, block_id: path };
  if (parentPath !== null) entry.nearest_parent_block_id = parentPath;
  if (node.rule_name !== undefined) entry.rule_name = node.rule_name;
  if (node.parameter_name !== undefined) entry.parameter_name = node.parameter_name;
  return [entry, ...node.children.flatMap((c) => flattenBlockMap(c, path))];
}

/** Substitute the configured DOCUMENT marker for the placeholder the codec carries (FR-063). The
 *  placeholder only ever appears as a template *value*, so an exact string-value swap suffices; it
 *  never touches the codec's own `$` marker or user data. Cached per (artifact, marker). */
function withMarker(value: Json, marker: string): Json {
  if (value === DOC_MARKER_PLACEHOLDER) return marker;
  if (Array.isArray(value)) return value.map((v) => withMarker(v, marker));
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) out[k] = withMarker(v, marker);
    return out;
  }
  return value;
}
const markerCache = new WeakMap<Artifact, Map<string, Record<string, Json>>>();
function fragmentsForMarker(artifact: Artifact, marker: string): Record<string, Json> {
  let perMarker = markerCache.get(artifact);
  if (!perMarker) markerCache.set(artifact, (perMarker = new Map()));
  let frags = perMarker.get(marker);
  if (!frags) perMarker.set(marker, (frags = withMarker(artifact.fragments, marker) as Record<string, Json>));
  return frags;
}

async function runArtifact(
  engine: EngineProvider,
  artifact: Artifact,
  input: Json,
  marker: string,
): Promise<Json> {
  const fragments = fragmentsForMarker(artifact, marker);
  const template = fragments[artifact.entry];
  if (template === undefined) {
    throw new CodecError(`codec artifact missing entry fragment '${artifact.entry}'`);
  }
  const res = await engine.transform(template, input, {
    marker: CODEC_MARKER,
    includes: fragments,
    maxIncludeDepth: CODEC_MAX_INCLUDE_DEPTH,
  });
  if (res.status !== 'ok' || !res.success) {
    throw new CodecError(res.error_message ?? 'codec execution failed', res.error_type, res.raw_engine_error);
  }
  return res.output as Json;
}

/** Encode a Transon document into Blockly workspace-serialization JSON (FR-114/124). `marker` is
 *  the document's configured marker key (FR-063), default `$`. `artifacts` overrides the committed
 *  codec with a session-generated set (RFC-007/FR-139); omitted = the committed default. */
export function encode(
  engine: EngineProvider,
  document: Json,
  marker: string = CODEC_MARKER,
  artifacts?: CodecArtifacts,
): Promise<Json> {
  return runArtifact(engine, (artifacts?.encoder as Artifact) ?? ENCODER, document, marker);
}

/** Decode Blockly workspace JSON back into a Transon document (FR-114/126); inverse of `encode`. */
export function decode(
  engine: EngineProvider,
  workspace: Json,
  marker: string = CODEC_MARKER,
  artifacts?: CodecArtifacts,
): Promise<Json> {
  return runArtifact(engine, (artifacts?.decoder as Artifact) ?? DECODER, workspace, marker);
}

/**
 * Run an arbitrary codec artifact (not just the committed encoder/decoder) through the host engine,
 * the same two-pass way `encode`/`decode` run the committed ones (marker substitution + the host
 * `EngineProvider`, AD-030). Used to execute a *freshly generated* codec — e.g. the AC-034
 * projection-coverage proof that a synthetic rule folds in with no projection change, and the
 * future runtime metadata-source policy (re-generate the codec from host metadata, ROADMAP).
 */
export function runCodecArtifact(
  engine: EngineProvider,
  artifact: { entry: string; fragments: Record<string, Json> },
  input: Json,
  marker: string = CODEC_MARKER,
): Promise<Json> {
  return runArtifact(engine, artifact as Artifact, input, marker);
}

/**
 * The `JsonPathBlockMap` for a document — emitted alongside the workspace as the codec walks
 * (FR-091/094/122, §9.12). Each entry maps a JSON `template_path` to its `block_id` (the path),
 * with `rule_name`/`parameter_name` where applicable and the `nearest_parent_block_id` for the
 * enclosing block. Consumed for error→block highlighting in M4 (FR-092/093/095).
 */
export async function blockMap(
  engine: EngineProvider,
  document: Json,
  marker: string = CODEC_MARKER,
  artifacts?: CodecArtifacts,
): Promise<JsonPathBlockMap> {
  const root = (await runArtifact(
    engine,
    (artifacts?.blockmap as Artifact) ?? BLOCKMAP,
    { n: document },
    marker,
  )) as unknown as MapNode;
  return flattenBlockMap(root, null);
}

/** A failure surfaced by the host engine while running a codec artifact (§16.4 taxonomy). */
export class CodecError extends Error {
  constructor(
    message: string,
    readonly errorType?: string,
    readonly rawEngineError?: string,
  ) {
    super(message);
    this.name = 'CodecError';
  }
}
