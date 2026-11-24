import { describe, it, expect } from 'vitest';
import SCOBot from '../src/core/SCOBot.js';
import { strictApi2004, strictApi12 } from './mocks/strictApi.js';

// The LMS pass mark must reach gradeIt(). Through 5.2.6 a SCORM 2004 cmi.scaled_passing_score was written
// to settings only, while gradeIt() reads the buffer, so every 2004 course graded against SCOBot's 0.7
// (relay docs/superpowers/relay/2026-11-08-from-scobot-lms-passing-score.md). The values below are the ones
// the scobot LMS seeds: 2004 = the primary objective's minNormalizedMeasure, a real in [-1, 1] rendered as a
// plain decimal, "1.0" when satisfiedByMeasure is true with no minNormalizedMeasure, unset (GetValue '' + 403)
// otherwise; 1.2 = adlcp:masteryscore as written, 0..100.

const make04 = (seed, opts = {}) => {
  window.API = undefined;
  const store = seed === undefined ? {} : { 'cmi.scaled_passing_score': seed };
  const rec = strictApi2004({ store });
  window.API_1484_11 = rec.api;
  const s = new SCOBot({ use_standalone: false, ...opts });
  s.initSCO();
  return { s, rec };
};
const make12 = (seed, opts = {}) => {
  window.API_1484_11 = undefined;
  const store = seed === undefined ? {} : { 'cmi.student_data.mastery_score': seed };
  const rec = strictApi12({ store });
  window.API = rec.api;
  const s = new SCOBot({ use_standalone: false, ...opts });
  s.initSCO();
  return { s, rec };
};
const grade = (s, raw, max = '100') => {
  s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: max });
  s.setvalue('cmi.score.raw', raw);
  s.gradeIt();
};

describe('SCORM 2004: the LMS cmi.scaled_passing_score grades the learner', () => {
  // [LMS value, learner raw of 0..100, expected success_status]
  const rows = [
    ['0.6', '65', 'passed'],   // the relay's defect row: graded failed against 0.7 through 5.2.6
    ['0.8', '65', 'failed'],
    ['0.65', '65', 'passed'],  // boundary: scaled == pass mark passes
    ['0.5', '49', 'failed'],
    ['1.0', '65', 'failed'],   // LMS default (satisfiedByMeasure true, no minNormalizedMeasure)
    ['1.0', '100', 'passed'],
    ['0', '0', 'passed'],
    ['-1', '0', 'passed'],     // -1 is in range; through 5.2.6 it fell back to 0.7
    ['0.0000001', '1', 'passed'], // the LMS re-renders an exponent mark as a plain decimal
    ['60', '65', 'passed'],    // legacy tolerance: a 1.2-style percentage from a 2004 LMS
    ['80', '65', 'failed'],
  ];
  for (const hold of [false, true]) {
    const tag = hold ? 'doNotStatusUntilFinish on' : 'option off';
    for (const [lms, raw, want] of rows) {
      it(`LMS "${lms}", raw ${raw}/100 -> ${want} (${tag})`, () => {
        const { s, rec } = make04(lms, { doNotStatusUntilFinish: hold });
        grade(s, raw);
        s.finish();
        expect(rec.data['cmi.success_status']).toBe(want);
      });
    }
  }

  it('the LMS value lands in buffer and settings alike', () => {
    const { s } = make04('0.6');
    expect(s.buffer.scaled_passing_score).toBe('0.6');
    expect(s.settings.scaled_passing_score).toBe('0.6');
  });

  it('the LMS value beats a configured scaled_passing_score', () => {
    const { s, rec } = make04('0.8', { scaled_passing_score: 0.5 });
    grade(s, '65');
    expect(rec.data['cmi.success_status']).toBe('failed');
  });

  it('unset (GetValue "" + 403): the default 0.7 stands', () => {
    const { s, rec } = make04(undefined);
    expect(s.buffer.scaled_passing_score).toBe(0.7);
    grade(s, '65');
    expect(rec.data['cmi.success_status']).toBe('failed');
  });

  it('unset: a configured scaled_passing_score stands', () => {
    const { s, rec } = make04(undefined, { scaled_passing_score: 0.6 });
    grade(s, '65');
    expect(rec.data['cmi.success_status']).toBe('passed');
  });

  for (const bad of ['abc', 'NaN', '-2', '150', '1e-7', ' ']) {
    it(`invalid LMS value ${JSON.stringify(bad)}: the configured mark stands, never NaN`, () => {
      const { s, rec } = make04(bad, { scaled_passing_score: 0.6 });
      expect(s.buffer.scaled_passing_score).toBe(0.6);
      grade(s, '65');
      expect(rec.data['cmi.success_status']).toBe('passed');
    });
  }
});

describe('SCORM 1.2: cmi.student_data.mastery_score (0..100) grades the learner', () => {
  const LS = 'cmi.core.lesson_status';
  const rows = [
    ['60', '65', 'passed'],
    ['80', '65', 'failed'],
    ['65', '65', 'passed'],   // boundary
    ['1', '65', 'passed'],    // 1% (through 5.2.6 a mark of "1" fell back to 0.7)
    ['100', '99', 'failed'],
  ];
  for (const [lms, raw, want] of rows) {
    it(`mastery_score "${lms}", raw ${raw}/100 -> ${want}`, () => {
      const { s, rec } = make12(lms);
      grade(s, raw);
      s.finish();
      expect(rec.data[LS]).toBe(want);
    });
  }

  it('mastery_score "70" lands as 0.7 in buffer and settings', () => {
    const { s } = make12('70');
    expect(s.buffer.scaled_passing_score).toBe('0.7');
    expect(s.settings.scaled_passing_score).toBe('0.7');
  });

  for (const blank of [undefined, '', '150', '-5', 'abc']) {
    it(`mastery_score ${JSON.stringify(blank)}: the configured mark stands`, () => {
      const { s, rec } = make12(blank, { scaled_passing_score: 0.6 });
      expect(s.buffer.scaled_passing_score).toBe(0.6);
      grade(s, '65');
      s.finish();
      expect(rec.data[LS]).toBe('passed');
    });
  }
});
