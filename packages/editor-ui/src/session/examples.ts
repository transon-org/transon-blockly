// Example corpus loader (FR-079, FR-009, AC-018/019). Flattens the committed engine docs payload —
// `docs.{rules,operators,functions}[*].examples[*]` (bundled at build time, OQ-003) — into the
// `ExampleCase[]` the Examples panel consumes. Each example carries the Transon template plus its
// sample input (`data`) and expected output (`result`) for actual-vs-expected display (§12.9, AC-019).
// Pure data over the metadata snapshot (AD-012); an embedder may override with `host.examples`.

import { editorMetadata, stableStringify } from '@transon/editor-core';
import type { EditorMetadata, Json } from '@transon/editor-core';
import type { ExampleCase } from './host.js';

type Family = 'rules' | 'operators' | 'functions';
const FAMILY_TAG: Record<Family, string> = {
  rules: 'rule',
  operators: 'operator',
  functions: 'function',
};

function str(v: Json | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Build the built-in example corpus from the committed metadata docs. Returns one `ExampleCase` per
 * `examples[*]` entry, tagged with the owning rule/operator/function name and family. Defaults to the
 * pinned snapshot; pass `metadata` to build from an alternate (e.g. host-provided) payload.
 */
export function buildExampleCorpus(metadata: EditorMetadata = editorMetadata): ExampleCase[] {
  const out: ExampleCase[] = [];
  // The same example is listed under several entries (e.g. one `expr` example under multiple
  // operators); dedupe by full content so the corpus has one entry per distinct example. `usedNames`
  // then guarantees a unique display/selection name even if two DIFFERENT examples share a `name`.
  const seenContent = new Set<string>();
  const usedNames = new Set<string>();

  for (const family of ['rules', 'operators', 'functions'] as const) {
    for (const entry of metadata.docs[family]) {
      const examples = (entry.examples as Json[] | undefined) ?? [];
      for (const raw of examples) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const ex = raw as Record<string, Json>;
        if (!('template' in ex)) continue;

        const signature = stableStringify([
          ex.name ?? null,
          ex.template,
          ex.data ?? null,
          ex.result ?? null,
        ]);
        if (seenContent.has(signature)) continue; // exact duplicate under another entry
        seenContent.add(signature);

        let name = str(ex.name) ?? `${entry.name}-${out.length}`;
        if (usedNames.has(name)) {
          let i = 2;
          while (usedNames.has(`${name} (${i})`)) i++;
          name = `${name} (${i})`;
        }
        usedNames.add(name);

        out.push({
          name,
          doc: str(ex.doc),
          template: ex.template as Json,
          data: 'data' in ex ? ex.data : undefined,
          result: 'result' in ex ? ex.result : undefined,
          rule: family === 'rules' ? entry.name : undefined,
          tags: [FAMILY_TAG[family]],
        });
      }
    }
  }
  return out;
}
