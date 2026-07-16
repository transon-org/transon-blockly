// FR-140 — runtime-metadata compatibility gate (same-major metadata_version, structural
//          completeness; contract §5) and fail-safe classification.
// FR-141 — data-driven presentation fallback for fetched rules unknown to the committed
//          presentation (title = metadata name, declared fallback category, advanced).
//
// Engine-free: these cover the pure helpers of the runtime metadata source (SPEC §7.18, RFC-007,
// AD-036). The engine-executed side (fetch → generate → project) is covered in the Node adapter's
// dynamic-surface tests (AC-043).
import { describe, expect, it } from 'vitest';
import {
  isCompatibleMetadataVersion,
  validateMetadataPayload,
  presentationWithFallback,
  MetadataFallbackError,
} from '../src/metadata/dynamic.js';
import { editorMetadata, metadataVersion } from '../src/metadata/snapshot.js';
import { PRESENTATION } from '../src/codec/presentation.js';
import type { Json } from '../src/engine/ports.js';

describe('FR-140 — same-major metadata_version gate (contract §5)', () => {
  it('accepts the pinned version itself and any same-major minor', () => {
    expect(isCompatibleMetadataVersion(metadataVersion)).toBe(true); // "3.0"
    expect(isCompatibleMetadataVersion('3.0')).toBe(true);
    expect(isCompatibleMetadataVersion('3.1')).toBe(true);
    expect(isCompatibleMetadataVersion('3.99')).toBe(true);
  });

  it('rejects a different major, missing, or malformed version', () => {
    expect(isCompatibleMetadataVersion('2.2')).toBe(false);
    expect(isCompatibleMetadataVersion('4.0')).toBe(false);
    expect(isCompatibleMetadataVersion(undefined)).toBe(false);
    expect(isCompatibleMetadataVersion(null)).toBe(false);
    expect(isCompatibleMetadataVersion('')).toBe(false);
    expect(isCompatibleMetadataVersion('not-a-version')).toBe(false);
  });

  it('accepts the engine emitting the version as a bare number (same normalization as the snapshot loader)', () => {
    expect(isCompatibleMetadataVersion(3.0 as unknown as string)).toBe(true);
    expect(isCompatibleMetadataVersion(2 as unknown as string)).toBe(false);
  });
});

describe('FR-140 — structural completeness of the fetched payload (contract §2)', () => {
  it('accepts the pinned snapshot itself (the reference §2 shape)', () => {
    const meta = validateMetadataPayload(editorMetadata as unknown as Json);
    expect(meta.catalog.rules.length).toBeGreaterThan(0);
    expect(meta.metadata_version).toBe(metadataVersion);
  });

  it('rejects non-object, missing-catalog, and version-incompatible payloads as MetadataFallbackError', () => {
    for (const bad of [null, 'x', { docs: {} }, { catalog: { rules: [] } }] as Json[]) {
      expect(() => validateMetadataPayload(bad)).toThrow(MetadataFallbackError);
    }
    const wrongMajor = { ...(editorMetadata as unknown as Record<string, Json>), metadata_version: '4.0' };
    expect(() => validateMetadataPayload(wrongMajor as unknown as Json)).toThrow(MetadataFallbackError);
  });

  it('rejects a catalog whose rules are missing names (malformed §2 entries)', () => {
    const bad = {
      metadata_version: metadataVersion,
      engine_version: null,
      catalog: { rules: [{ params: [] }], operators: [], functions: [] },
      docs: { examples: [], rules: [], operators: [], functions: [], worked_examples: [], recipes: [] },
    };
    expect(() => validateMetadataPayload(bad as unknown as Json)).toThrow(MetadataFallbackError);
  });
});

describe('FR-141 — presentation fallback for rules unknown to the committed presentation', () => {
  it('adds a fallback entry (metadata name as title, declared fallback category, advanced) for unknown rules only', () => {
    const catalog = [...editorMetadata.catalog.rules, { name: 'brandnewrule', params: [], variants: [] }];
    const p = presentationWithFallback(catalog as never);
    expect(p.rules['brandnewrule']).toEqual({
      title: 'brandnewrule',
      category: PRESENTATION.fallbackCategory,
      advanced: true,
    });
    // Known rules keep their committed presentation untouched (FR-141).
    expect(p.rules['attr']).toEqual(PRESENTATION.rules['attr']);
    // The declared fallback category is a real §12.4 category (data-driven, FR-127).
    expect(PRESENTATION.categoryOrder).toContain(PRESENTATION.fallbackCategory);
    expect(PRESENTATION.categoryColour[PRESENTATION.fallbackCategory]).toBeDefined();
  });

  it('is the identity for a catalog fully covered by the committed presentation', () => {
    const p = presentationWithFallback(editorMetadata.catalog.rules);
    expect(p.rules).toEqual(PRESENTATION.rules);
  });
});
