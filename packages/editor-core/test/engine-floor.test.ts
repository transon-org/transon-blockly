// FR-142 / NFR-051 (SPEC §7.19, AD-037) — the codec engine floor: one declared constant naming
// the minimum engine whose surface the committed codec artifacts require, plus the total,
// never-throwing version comparison the session-init check uses.
import { describe, expect, it } from 'vitest';
import { CODEC_ENGINE_FLOOR, isBelowEngineFloor } from '../src/index.js';

describe('CODEC_ENGINE_FLOOR (FR-142, NFR-051)', () => {
  it('declares 0.1.8 — the engine that introduced the total `in` operator and `length`', () => {
    expect(CODEC_ENGINE_FLOOR).toBe('0.1.8');
  });
});

describe('isBelowEngineFloor (FR-142)', () => {
  it('true strictly below the floor', () => {
    expect(isBelowEngineFloor('0.1.7')).toBe(true);
    expect(isBelowEngineFloor('0.1.0')).toBe(true);
    expect(isBelowEngineFloor('0.0.9')).toBe(true);
  });
  it('false at and above the floor', () => {
    expect(isBelowEngineFloor('0.1.8')).toBe(false);
    expect(isBelowEngineFloor('0.1.9')).toBe(false);
    expect(isBelowEngineFloor('0.2.0')).toBe(false);
    expect(isBelowEngineFloor('1.0.0')).toBe(false);
  });
  it('numeric comparison, not lexicographic', () => {
    expect(isBelowEngineFloor('0.1.10')).toBe(false); // '0.1.10' < '0.1.8' lexicographically
    expect(isBelowEngineFloor('0.10.0')).toBe(false);
  });
  it('shorter/longer dotted forms compare with implicit zeros', () => {
    expect(isBelowEngineFloor('0.1')).toBe(true); // 0.1.0
    expect(isBelowEngineFloor('0.2')).toBe(false); // 0.2.0
    expect(isBelowEngineFloor('0.1.8.1')).toBe(false);
  });
  it('tolerates a leading v', () => {
    expect(isBelowEngineFloor('v0.1.7')).toBe(true);
    expect(isBelowEngineFloor('v0.2.0')).toBe(false);
  });
  it('accepts standard pre-release/build separators after the numeric core', () => {
    expect(isBelowEngineFloor('0.1.7-rc1')).toBe(true);
    expect(isBelowEngineFloor('0.1.8-rc1')).toBe(false);
    expect(isBelowEngineFloor('0.1.7+build5')).toBe(true);
  });
  it('unknown/unparsable versions are NEVER below the floor (no diagnostic on unknown)', () => {
    expect(isBelowEngineFloor(null)).toBe(false);
    expect(isBelowEngineFloor(undefined)).toBe(false);
    expect(isBelowEngineFloor('')).toBe(false);
    expect(isBelowEngineFloor('fake-0.0.0')).toBe(false);
    expect(isBelowEngineFloor('unknown')).toBe(false);
  });
  it('a numeric prefix with trailing junk is unknown, not parsed (review PR #16)', () => {
    expect(isBelowEngineFloor('0.1.7garbage')).toBe(false);
    expect(isBelowEngineFloor('0.1.7.unknown')).toBe(false);
    expect(isBelowEngineFloor('0.1.x')).toBe(false);
  });
});
