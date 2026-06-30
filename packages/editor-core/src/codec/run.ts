// Codec runtime (AD-008, AD-030, AD-032, FR-119/124/126).
//
// `encode` turns a Transon document into Blockly workspace-serialization JSON; `decode` is
// its structural inverse. Both are *executions of the committed codec artifacts* through a
// host-provided engine (two-pass generate-then-run): this module bundles no engine and
// contains no codec↔workspace mapping — it hands the artifact + data to `EngineProvider`
// and returns the result verbatim (FR-126, AD-032).

import type { EngineProvider, Json } from '../engine/ports.js';
import encoderArtifact from './artifacts/encoder.json' with { type: 'json' };
import decoderArtifact from './artifacts/decoder.json' with { type: 'json' };

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

async function runArtifact(
  engine: EngineProvider,
  artifact: Artifact,
  input: Json,
): Promise<Json> {
  const template = artifact.fragments[artifact.entry];
  if (template === undefined) {
    throw new CodecError(`codec artifact missing entry fragment '${artifact.entry}'`);
  }
  const res = await engine.transform(template, input, {
    marker: CODEC_MARKER,
    includes: artifact.fragments,
    maxIncludeDepth: CODEC_MAX_INCLUDE_DEPTH,
  });
  if (res.status !== 'ok' || !res.success) {
    throw new CodecError(res.error_message ?? 'codec execution failed', res.error_type, res.raw_engine_error);
  }
  return res.output as Json;
}

/** Encode a Transon document into Blockly workspace-serialization JSON (FR-114/124). */
export function encode(engine: EngineProvider, document: Json): Promise<Json> {
  return runArtifact(engine, ENCODER, document);
}

/** Decode Blockly workspace JSON back into a Transon document (FR-114/126); inverse of `encode`. */
export function decode(engine: EngineProvider, workspace: Json): Promise<Json> {
  return runArtifact(engine, DECODER, workspace);
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
