import { describe, it, expect } from 'vitest';
import SCOBot from '../src/core/SCOBot.js';
import { strictApi2004, strictApi12 } from './mocks/strictApi.js';

const LS = 'cmi.core.lesson_status';
const make12 = (opts = {}, store = {}) => {
  window.API_1484_11 = undefined;
  const rec = strictApi12({ store });
  window.API = rec.api;
  const s = new SCOBot({ use_standalone: false, ...opts });
  s.initSCO();
  return { s, rec };
};
const make04 = (opts = {}, store = {}) => {
  window.API = undefined;
  const rec = strictApi2004({ store });
  window.API_1484_11 = rec.api;
  const s = new SCOBot({ use_standalone: false, ...opts });
  s.initSCO();
  return { s, rec };
};

describe('SCORM 1.2: an author default never overwrites a real lesson_status (U5)', () => {
  for (const hold of [false, true]) {
    const tag = hold ? 'doNotStatusUntilFinish on' : 'option off';
    it(`gradeIt passed survives completion_status:'incomplete' default (persist completion_status), ${tag}`, () => {
      const { s, rec } = make12({ scorm_status_persist: 'completion_status', completion_status: 'incomplete', doNotStatusUntilFinish: hold });
      s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
      s.setvalue('cmi.score.raw', '90');
      s.gradeIt();
      s.finish();
      expect(rec.data[LS]).toBe('passed');
    });

    it(`content-written completed survives a success_status:'failed' default, ${tag}`, () => {
      const { s, rec } = make12({ success_status: 'failed', doNotStatusUntilFinish: hold });
      s.setvalue('cmi.core.lesson_status', 'completed');
      s.finish();
      expect(rec.data[LS]).toBe('completed');
    });

    it(`a never-graded course still gets the 'failed' default, ${tag}`, () => {
      const { s, rec } = make12({ success_status: 'failed', doNotStatusUntilFinish: hold });
      s.finish();
      expect(rec.data[LS]).toBe('failed');
    });
  }
});

describe('gradeIt() with no raw score (U6)', () => {
  for (const hold of [false, true]) {
    const tag = hold ? 'option on' : 'option off';
    it(`sends no scaled score and invents no success_status, ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold });
      s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
      const mark = rec.calls.length;
      s.gradeIt();
      if (hold) s.finish();
      const after = rec.calls.slice(mark);
      expect(after.filter((c) => c.startsWith('SetValue cmi.score.scaled'))).toEqual([]);
      expect(after.filter((c) => c.startsWith('SetValue cmi.success_status'))).toEqual([]);
      expect(rec.errors).not.toContain('406');
      expect(rec.data['cmi.success_status']).toBe('unknown');
    });

    it(`completion follows progress exactly as before, ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold });
      s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
      s.gradeIt();
      if (hold) s.finish();
      expect(rec.data['cmi.completion_status']).toBe('completed');
    });

    it(`a raw of '0' is a real score and is graded, ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold });
      s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
      s.setvalue('cmi.score.raw', '0');
      s.gradeIt();
      if (hold) s.finish();
      expect(Number(rec.data['cmi.score.scaled'])).toBe(0);
      expect(rec.data['cmi.success_status']).toBe('failed');
    });
  }
});

describe('gradeIt() decision table (U6/U7, zero-width, 1.2 parity)', () => {
  const T = (s, min, max) => s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: min, scoreMax: max });
  for (const hold of [false, true]) {
    const tag = hold ? 'option on' : 'option off';
    it(`zero-width range with no raw: nothing to grade (2004), ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold });
      T(s, '50', '50');
      const mark = rec.calls.length;
      s.gradeIt();
      if (hold) s.finish();
      const after = rec.calls.slice(mark);
      expect(after.filter((c) => c.startsWith('SetValue cmi.score.scaled'))).toEqual([]);
      expect(after.filter((c) => c.startsWith('SetValue cmi.success_status'))).toEqual([]);
      expect(rec.data['cmi.success_status']).toBe('unknown');
    });
    it(`zero-width range with no raw: nothing to grade (1.2), ${tag}`, () => {
      const { s, rec } = make12({ doNotStatusUntilFinish: hold });
      T(s, '50', '50');
      s.gradeIt();
      if (hold) s.finish();
      expect(rec.data[LS]).toBe('completed');
      expect(rec.calls.filter((c) => /lesson_status=(passed|failed)/.test(c))).toEqual([]);
    });
    it(`zero-width range WITH raw: scaled 1, passed (2004), ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold });
      T(s, '50', '50');
      s.setvalue('cmi.score.raw', '50');
      s.gradeIt();
      if (hold) s.finish();
      expect(Number(rec.data['cmi.score.scaled'])).toBe(1);
      expect(rec.data['cmi.success_status']).toBe('passed');
    });
    it(`zero-width range WITH raw: lesson_status passed (1.2), ${tag}`, () => {
      const { s, rec } = make12({ doNotStatusUntilFinish: hold });
      T(s, '50', '50');
      s.setvalue('cmi.score.raw', '50');
      s.gradeIt();
      if (hold) s.finish();
      expect(rec.data[LS]).toBe('passed');
    });
    it(`raw 90 with no bounds: no scaled, no 406, success not written (2004), ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold });
      s.setvalue('cmi.score.raw', '90');
      const mark = rec.calls.length;
      s.gradeIt();
      if (hold) s.finish();
      const after = rec.calls.slice(mark);
      expect(after.filter((c) => c.startsWith('SetValue cmi.score.scaled'))).toEqual([]);
      expect(after.filter((c) => c.startsWith('SetValue cmi.success_status'))).toEqual([]);
      expect(rec.errors).not.toContain('406');
      expect(rec.data['cmi.completion_status']).toBe('completed');
    });
    it(`raw 90 with no bounds (1.2): lesson_status is not failed, ${tag}`, () => {
      const { s, rec } = make12({ doNotStatusUntilFinish: hold });
      s.setvalue('cmi.score.raw', '90');
      s.gradeIt();
      if (hold) s.finish();
      expect(rec.data[LS]).toBe('completed');
    });
    it(`1.2: setTotals then gradeIt with no raw writes no failed; completed stays, ${tag}`, () => {
      const { s, rec } = make12({ doNotStatusUntilFinish: hold });
      T(s, '0', '100');
      s.gradeIt();
      if (hold) s.finish();
      expect(rec.data[LS]).toBe('completed');
      expect(rec.calls.filter((c) => c.includes('lesson_status=failed'))).toEqual([]);
    });
    it(`completion_threshold 0.5 with progress 0 is incomplete, ${tag}`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: hold, completion_threshold: 0.5 });
      T(s, '0', '100');
      s.setvalue('cmi.score.raw', '90');
      s.gradeIt();
      if (hold) s.finish();
      expect(rec.data['cmi.completion_status']).toBe('incomplete');
    });
  }
  it('1.2 happyEnding then gradeIt: option on ends where option off ends (I1)', () => {
    const run = (hold) => {
      const { s, rec } = make12({ doNotStatusUntilFinish: hold });
      T(s, '0', '100');
      s.happyEnding(); s.gradeIt(); s.finish();
      return rec.data[LS];
    };
    const off = run(false);
    expect(off).toBe('passed');
    expect(run(true)).toBe(off);
  });
});

describe('2004 is unchanged by U5 (M2)', () => {
  it('content completed + success_status default failed: success_status becomes failed', () => {
    const { s, rec } = make04({ success_status: 'failed' });
    s.setvalue('cmi.completion_status', 'completed');
    s.finish();
    expect(rec.data['cmi.success_status']).toBe('failed');
  });
});

describe('gradeIt() holds score.raw only when it is a real raw score (review follow-up B)', () => {
  for (const bad of ['  ', 'abc']) {
    it(`a stored raw of ${JSON.stringify(bad)} is not replayed (option on)`, () => {
      const { s, rec } = make04({ doNotStatusUntilFinish: true }, { 'cmi.score.raw': bad });
      s.gradeIt();
      s.finish();
      expect(rec.calls.filter((c) => c.startsWith('SetValue cmi.score.raw='))).toEqual([]);
      expect(rec.errors).not.toContain('406');
    });
  }
});

describe('SCORM 1.2 replay sends one lesson_status write for identical held statuses (follow-up C)', () => {
  it('same value: exactly one write in the burst, final value unchanged', () => {
    const { s, rec } = make12({ doNotStatusUntilFinish: true });
    s.setvalue(LS, 'passed');
    const mark = rec.calls.length;
    s.finish();
    const burst = rec.calls.slice(mark).filter((c) => c === `LMSSetValue ${LS}=passed`);
    expect(burst).toHaveLength(1);
    expect(rec.data[LS]).toBe('passed');
  });

  it('genuinely differing values (completed then failed via gradeIt): two writes, failed last, parity with option off', () => {
    const run = (hold) => {
      const { s, rec } = make12({ doNotStatusUntilFinish: hold });
      s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
      s.setvalue('cmi.core.score.raw', '10');
      s.gradeIt();
      const mark = rec.calls.length;
      s.finish();
      return { rec, burst: rec.calls.slice(mark).filter((c) => c.startsWith(`LMSSetValue ${LS}=`)) };
    };
    const on = run(true), off = run(false);
    expect(on.burst).toEqual([`LMSSetValue ${LS}=completed`, `LMSSetValue ${LS}=failed`]);
    expect(on.rec.data[LS]).toBe('failed');
    expect(on.rec.data).toEqual(off.rec.data);
  });
});
