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
 * The codec's `include`-recursion ceiling (§6.5, §16.4). The codec walks the document by
 * self-`include`; that recursion is host-stack-bound and overflows the host stack a little
 * below the engine default `max_include_depth` (50). We cap it well under that observed
 * host limit so deeply nested input fails cleanly with an engine depth error (surfaced as a
 * `CodecError`) instead of a raw stack overflow.
 */
export const CODEC_MAX_INCLUDE_DEPTH = 25;

interface Artifact {
  entry: string;
  fragments: Record<string, Json>;
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
 *  the document's configured marker key (FR-063), default `$`. */
export function encode(engine: EngineProvider, document: Json, marker: string = CODEC_MARKER): Promise<Json> {
  return runArtifact(engine, ENCODER, document, marker);
}

/** Decode Blockly workspace JSON back into a Transon document (FR-114/126); inverse of `encode`. */
export function decode(engine: EngineProvider, workspace: Json, marker: string = CODEC_MARKER): Promise<Json> {
  return runArtifact(engine, DECODER, workspace, marker);
}

/**
 * The `JsonPathBlockMap` for a document — emitted alongside the workspace as the codec walks
 * (FR-091/094/122, §9.12). Each entry maps a JSON `template_path` to its `block_id` (the path),
 * with `rule_name`/`parameter_name` where applicable and the `nearest_parent_block_id` for the
 * enclosing block. Consumed for error→block highlighting in M4 (FR-092/093/095).
 */
export async function blockMap(engine: EngineProvider, document: Json, marker: string = CODEC_MARKER): Promise<JsonPathBlockMap> {
  const root = (await runArtifact(engine, BLOCKMAP, { n: document }, marker)) as unknown as MapNode;
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
