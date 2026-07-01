// D2 — build the example corpus from the committed docs metadata (FR-079, AC-018). The editor loads
// examples from the generated example corpus (docs.{rules,operators,functions}[*].examples), each
// carrying template + sample input + expected result for actual-vs-expected display (AC-019).
import { describe, it, expect } from 'vitest';
import { buildExampleCorpus } from '../src/session/examples.js';

describe('buildExampleCorpus (FR-079, AC-018)', () => {
  const corpus = buildExampleCorpus();

  it('flattens the committed docs examples into distinct ExampleCase[] (147 raw → 89 deduped)', () => {
    // 147 raw examples, but 44 are the same example listed under multiple entries; dedupe by content.
    expect(corpus.length).toBe(89);
    for (const e of corpus) {
      expect(typeof e.name).toBe('string');
      expect(e.template).toBeDefined();
    }
  });

  it('carries sample input + expected result for actual-vs-expected (AC-019)', () => {
    const withResult = corpus.filter((e) => e.result !== undefined);
    expect(withResult.length).toBeGreaterThan(0);
    const attr = corpus.find((e) => e.rule === 'expr');
    expect(attr).toBeTruthy();
    expect(attr!.template).toBeTypeOf('object');
  });

  it('tags rule examples with their rule name and family', () => {
    const ruleExample = corpus.find((e) => e.rule);
    expect(ruleExample?.tags).toBeTruthy();
    expect(['rule', 'operator', 'function']).toContain(ruleExample!.tags![0]);
  });

  it('example names are unique (usable as a selection key)', () => {
    const names = corpus.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
