import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import SCOBot from '../src/core/SCOBot.js';
import SCOBotUtil from '../src/utils/SCOBotUtil.js';
import { strictApi2004, strictApi12 } from './mocks/strictApi.js';

const loaded = () => window.dispatchEvent(new Event('DOMContentLoaded'));

describe('one connection per page (U1)', () => {
  let rec;
  beforeEach(() => { window.API = undefined; rec = strictApi2004(); window.API_1484_11 = rec.api; });

  it('README Quick Start in one script: no Initialize after Terminate, no LMS error', () => {
    const s = new SCOBot({ use_standalone: false, exit_type: 'suspend' });
    s.initSCO(); s.setvalue('cmi.score.raw', '90'); s.finish();
    loaded(); // SCOBot's own auto-connect fires now
    expect(rec.calls.filter((c) => c === 'Initialize')).toHaveLength(1);
    expect(rec.errors.filter((c) => c !== '403')).toEqual([]);
  });

  it('a direct initSCO() while connected is a quiet yes, not an exception', () => {
    const s = new SCOBot({ use_standalone: false });
    const exc = []; SCOBotUtil.addEvent(s, 'exception', (e) => exc.push(e));
    expect(s.initSCO()).toBe('true');
    loaded();
    expect(s.initSCO()).toBe('true');
    expect(exc).toEqual([]);
    expect(rec.calls.filter((c) => c === 'Initialize')).toHaveLength(1);
  });

  it('initSCO() after finish() is a quiet no: no second Initialize, no exception, no 104', () => {
    const s = new SCOBot({ use_standalone: false });
    const exc = []; SCOBotUtil.addEvent(s, 'exception', (e) => exc.push(e));
    s.initSCO(); s.finish();
    expect(s.initSCO()).toBe('false');
    expect(rec.calls.filter((c) => c === 'Initialize')).toHaveLength(1);
    expect(exc).toEqual([]);
    expect(rec.errors).not.toContain('104');
  });

  it('content that never calls initSCO() is still connected by the auto-connect', () => {
    const s = new SCOBot({ use_standalone: false });
    loaded();
    expect(s.isConnectionActive()).toBe(true);
  });
});

describe('one connection per page, SCORM 1.2 (U1)', () => {
  let rec;
  beforeEach(() => { window.API_1484_11 = undefined; rec = strictApi12(); window.API = rec.api; });
  afterEach(() => { window.API = undefined; });

  it('initSCO() after finish() is a quiet no: no second LMSInitialize, no exception, no 104', () => {
    const s = new SCOBot({ use_standalone: false });
    const exc = []; SCOBotUtil.addEvent(s, 'exception', (e) => exc.push(e));
    expect(s.initSCO()).toBe('true');
    s.finish();
    expect(s.initSCO()).toBe('false');
    expect(rec.calls.filter((c) => c === 'LMSInitialize')).toHaveLength(1);
    expect(exc).toEqual([]);
    expect(rec.errors).not.toContain('104');
  });
});

describe('finish() on an unscored SCO (U2)', () => {
  it('writes no empty success_status or completion_status', () => {
    const rec = strictApi2004(); window.API_1484_11 = rec.api; window.API = undefined;
    const s = new SCOBot({ use_standalone: false });
    s.initSCO(); s.finish();
    expect(rec.calls).not.toContain('SetValue cmi.success_status=');
    expect(rec.calls).not.toContain('SetValue cmi.completion_status=');
    expect(rec.errors.filter((c) => c !== '403')).toEqual([]);
  });

  it('SCORM 1.2 (completion_status persist) never writes an empty lesson_status', () => {
    const calls = [];
    window.API_1484_11 = undefined;
    window.API = {
      LMSInitialize: () => 'true', LMSFinish: () => 'true', LMSCommit: () => 'true',
      LMSGetValue: () => '', LMSGetLastError: () => '0', LMSGetErrorString: () => '', LMSGetDiagnostic: () => '',
      LMSSetValue: (k, v) => { calls.push(`${k}=${v}`); return 'true'; }
    };
    const s = new SCOBot({ use_standalone: false, scorm_status_persist: 'completion_status' });
    s.initSCO(); s.finish();
    expect(calls.filter((c) => c.startsWith('cmi.core.lesson_status='))).toEqual([]);
  });
});

describe('doNotStatusUntilFinish holds SCOBot-managed status until finish() (U4)', () => {
  const HELD = /^SetValue cmi\.(completion_status|success_status|score\.raw|score\.scaled|progress_measure)=/;
  let rec;
  const make = (opts = {}, store = {}) => {
    window.API = undefined; rec = strictApi2004({ store }); window.API_1484_11 = rec.api;
    const s = new SCOBot({ use_standalone: false, doNotStatusUntilFinish: true, ...opts });
    s.initSCO();
    return s;
  };
  const totals = (s) => s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
  const since = (mark) => rec.calls.slice(mark);
  const realErrors = () => rec.errors.filter((c) => c !== '403');

  it('gradeIt() writes nothing to the LMS mid-session; finish() sends completed/passed/90/0.9', () => {
    const s = make(); totals(s);
    s.setvalue('cmi.score.raw', '90');
    const mark = rec.calls.length;
    s.gradeIt();
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
    s.finish();
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.success_status']).toBe('passed');
    expect(rec.data['cmi.score.raw']).toBe('90');
    expect(Number(rec.data['cmi.score.scaled'])).toBe(0.9);
    expect(realErrors()).toEqual([]);
  });

  it("the probe's mixed case: content's own completed/passed/90/0.9 survive finish()", () => {
    const s = make(); totals(s);
    s.setvalue('cmi.completion_status', 'completed'); s.setvalue('cmi.success_status', 'passed');
    s.setvalue('cmi.score.raw', '90'); s.setvalue('cmi.score.scaled', '0.9');
    s.finish();
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.success_status']).toBe('passed');
    expect(rec.data['cmi.score.raw']).toBe('90');
    expect(rec.data['cmi.score.scaled']).toBe('0.9');
    expect(realErrors()).toEqual([]);
  });

  it('happyEnding() sends only score min/max mid-session; finish() sends passed/completed/100/1', () => {
    const s = make();
    const mark = rec.calls.length;
    s.happyEnding();
    expect(since(mark)).toEqual(['SetValue cmi.score.min=0', 'SetValue cmi.score.max=100']);
    s.finish();
    expect(rec.data['cmi.success_status']).toBe('passed');
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.score.raw']).toBe('100');
    expect(rec.data['cmi.score.scaled']).toBe('1');
    expect(rec.data['cmi.progress_measure']).toBe('1');
    expect(realErrors()).toEqual([]);
  });

  it('a course that never graded: finish() writes no score or progress, no 406', () => {
    const s = make(); totals(s);
    s.finish();
    expect(rec.calls.filter((c) => /^SetValue cmi\.(score\.raw|score\.scaled|progress_measure)=/.test(c))).toEqual([]);
    expect(realErrors()).toEqual([]);
  });

  it('setObjective progress rollup is held back and sent by finish()', () => {
    // The strict mock does not maintain _count, so seed one objective slot.
    const s = make({}, { 'cmi.objectives._count': '1', 'cmi.objectives.0.id': 'o1' }); totals(s);
    const mark = rec.calls.length;
    s.setObjective({ id: 'o1', success_status: 'passed', completion_status: 'completed', progress_measure: '1', description: 'o1' });
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
    s.finish();
    expect(rec.data['cmi.progress_measure']).toBe('1');
  });

  it('gradeIt() without setTotals is still sent by finish(), not dropped', () => {
    const s = make();
    s.setvalue('cmi.score.max', '100'); s.setvalue('cmi.score.min', '0'); s.setvalue('cmi.score.raw', '90');
    const mark = rec.calls.length;
    s.gradeIt();
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
    s.finish();
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.success_status']).toBe('passed');
    expect(Number(rec.data['cmi.score.scaled'])).toBe(0.9);
  });

  it('timeout() replays the held status too', () => {
    const s = make(); totals(s);
    s.setvalue('cmi.score.raw', '90'); s.gradeIt();
    s.timeout();
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.success_status']).toBe('passed');
    expect(rec.data['cmi.score.raw']).toBe('90');
    expect(Number(rec.data['cmi.score.scaled'])).toBe(0.9);
  });

  it('a value the LMS rejected is not replayed at finish() (no second 406)', () => {
    const s = make(); totals(s);
    s.setvalue('cmi.success_status', 'bogus');
    expect(realErrors()).toEqual(['406']);
    s.finish();
    expect(realErrors()).toEqual(['406']);
  });

  it('SCORM 1.2: a content-level completed is not overwritten by the session-start lesson_status', () => {
    const data = { 'cmi.core.lesson_status': 'not attempted', 'cmi.core.entry': 'ab-initio' };
    window.API_1484_11 = undefined;
    window.API = {
      LMSInitialize: () => 'true', LMSFinish: () => 'true', LMSCommit: () => 'true',
      LMSGetValue: (k) => data[k] ?? '', LMSGetLastError: () => '0', LMSGetErrorString: () => '', LMSGetDiagnostic: () => '',
      LMSSetValue: (k, v) => { data[k] = String(v); return 'true'; }
    };
    const s = new SCOBot({ use_standalone: false, doNotStatusUntilFinish: true });
    s.initSCO(); totals(s);
    s.setvalue('cmi.completion_status', 'completed'); s.setvalue('cmi.score.raw', '90');
    s.finish();
    expect(data['cmi.core.lesson_status']).toBe('completed');
    expect(data['cmi.core.score.raw']).toBe('90');
  });

  // --- Fix round 1 ---
  const api12 = () => {
    const data = { 'cmi.core.lesson_status': 'not attempted', 'cmi.core.entry': 'ab-initio' };
    const calls = [];
    window.API_1484_11 = undefined;
    window.API = {
      LMSInitialize: () => 'true', LMSFinish: () => 'true', LMSCommit: () => 'true',
      LMSGetValue: (k) => data[k] ?? '', LMSGetLastError: () => '0', LMSGetErrorString: () => '', LMSGetDiagnostic: () => '',
      LMSSetValue: (k, v) => { calls.push(`${k}=${v}`); data[k] = String(v); return 'true'; }
    };
    return { data, calls };
  };
  const run12 = (dnsuf, steps) => {
    const r = api12();
    const s = new SCOBot({ use_standalone: false, doNotStatusUntilFinish: dnsuf });
    s.initSCO(); totals(s); steps(s); s.finish();
    return r.data;
  };

  it('owner ruling: suspend() also sends the held status (completed/passed/90/0.9)', () => {
    const s = make(); totals(s);
    s.setvalue('cmi.score.raw', '90');
    const mark = rec.calls.length;
    s.gradeIt();
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
    s.suspend();
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.success_status']).toBe('passed');
    expect(rec.data['cmi.score.raw']).toBe('90');
    expect(Number(rec.data['cmi.score.scaled'])).toBe(0.9);
    expect(realErrors()).toEqual([]);
  });

  it('content writing status through the raw LMS API is not reset by finish()', () => {
    const s = make(); totals(s);
    window.API_1484_11.SetValue('cmi.completion_status', 'completed');
    window.API_1484_11.SetValue('cmi.success_status', 'passed');
    s.finish();
    expect(rec.data['cmi.completion_status']).toBe('completed');
    expect(rec.data['cmi.success_status']).toBe('passed');
  });

  it('setTotals then finish(): no completion/success replayed (nothing was set this session)', () => {
    const s = make(); totals(s);
    const mark = rec.calls.length;
    s.finish();
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
    expect(realErrors()).toEqual([]);
  });

  it('updateStatus(false) with exit_type finish writes no default status mid-session while holding', () => {
    const s = make({ exit_type: 'finish', success_status: 'failed' });
    const mark = rec.calls.length;
    s.updateStatus(false);
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
  });

  it('SCORM 1.2 happyEnding: option on ends on the same lesson_status as option off', () => {
    const off = run12(false, (s) => s.happyEnding());
    const on = run12(true, (s) => s.happyEnding());
    expect(off['cmi.core.lesson_status']).toBe('completed');
    expect(on['cmi.core.lesson_status']).toBe(off['cmi.core.lesson_status']);
    expect(on['cmi.core.score.raw']).toBe(off['cmi.core.score.raw']);
  });

  it('SCORM 1.2 gradeIt: option on ends on the same lesson_status as option off', () => {
    const steps = (s) => { s.setvalue('cmi.score.raw', '90'); s.gradeIt(); };
    const off = run12(false, steps);
    const on = run12(true, steps);
    expect(off['cmi.core.lesson_status']).toBe('passed');
    expect(on['cmi.core.lesson_status']).toBe(off['cmi.core.lesson_status']);
  });

  it('R4: a finish whose Terminate failed, then exitSCO, does not send the status burst a second time', () => {
    const s = make(); totals(s);
    s.setvalue('cmi.score.raw', '90'); s.gradeIt();
    const r = rec; r.api.Terminate = () => { r.calls.push('Terminate'); return 'false'; };
    s.finish();
    const mark = rec.calls.length;
    s.exitSCO();
    expect(since(mark).filter((c) => HELD.test(c))).toEqual([]);
  });

  it('page unload (beforeunload then unload) sends one Terminate and one status burst', () => {
    // Instances do NOT get their own API (s.API.path === rec.api); stale instances from earlier tests
    // write into their own captured rec, so this rec sees only this instance.
    const s = make(); totals(s);
    s.setvalue('cmi.score.raw', '90'); s.gradeIt();
    const mark = rec.calls.length;
    window.dispatchEvent(new Event('beforeunload'));
    window.dispatchEvent(new Event('unload'));
    const after = since(mark);
    expect(after.filter((c) => c === 'Terminate')).toHaveLength(1);
    for (const k of ['cmi.completion_status', 'cmi.success_status', 'cmi.score.raw', 'cmi.score.scaled']) {
      expect(after.filter((c) => c.startsWith(`SetValue ${k}=`)), k).toHaveLength(1);
    }
  });

  it('R1: a default success_status with nothing graded: finish tail is identical to option off', () => {
    const tail = (on) => {
      window.API = undefined; rec = strictApi2004(); window.API_1484_11 = rec.api;
      const s = new SCOBot({ use_standalone: false, doNotStatusUntilFinish: on, success_status: 'failed' });
      s.initSCO();
      const mark = rec.calls.length;
      s.finish();
      return rec.calls.slice(mark).map((c) => c.replace(/(session_time=).*/, '$1*'));
    };
    const off = tail(false); const on = tail(true);
    expect(off).toContain('SetValue cmi.success_status=failed');
    expect(on).toEqual(off);
  });

  it('a non-empty default does not clobber the content\'s own passed', () => {
    const s = make({ success_status: 'failed' });
    s.setvalue('cmi.success_status', 'passed');
    s.finish();
    expect(rec.data['cmi.success_status']).toBe('passed');
  });
});

describe('doNotStatusUntilFinish OFF: call sequences pinned (recorded from the tree verified identical to 5.2.5)', () => {
  let rec;
  const make = (store = {}) => {
    window.API = undefined; rec = strictApi2004({ store }); window.API_1484_11 = rec.api;
    const s = new SCOBot({ use_standalone: false });
    s.initSCO();
    s.setTotals({ totalInteractions: '1', totalObjectives: '1', scoreMin: '0', scoreMax: '100' });
    return s;
  };

  it('gradeIt()', () => {
    const s = make(); const mark = rec.calls.length;
    s.setvalue('cmi.score.raw', '90'); s.gradeIt();
    expect(rec.calls.slice(mark)).toEqual([
      'SetValue cmi.score.raw=90', 'SetValue cmi.score.scaled=0.9000000',
      'SetValue cmi.completion_status=completed', 'SetValue cmi.success_status=passed']);
  });

  it('happyEnding()', () => {
    const s = make(); const mark = rec.calls.length;
    s.happyEnding();
    expect(rec.calls.slice(mark)).toEqual([
      'SetValue cmi.score.scaled=1', 'SetValue cmi.score.min=0', 'SetValue cmi.score.max=100',
      'SetValue cmi.score.raw=100', 'SetValue cmi.success_status=passed', 'SetValue cmi.progress_measure=1',
      'SetValue cmi.completion_status=completed']);
  });

  it('setObjective() progress rollup', () => {
    const s = make({ 'cmi.objectives._count': '1', 'cmi.objectives.0.id': 'o1' }); const mark = rec.calls.length;
    s.setObjective({ id: 'o1', success_status: 'passed', completion_status: 'completed', progress_measure: '1', description: 'o1' });
    expect(rec.calls.slice(mark)).toEqual([
      'SetValue cmi.objectives.0.id=o1', 'SetValue cmi.objectives.0.success_status=passed',
      'SetValue cmi.objectives.0.completion_status=completed', 'SetValue cmi.objectives.0.progress_measure=1',
      'SetValue cmi.objectives.0.description=o1', 'SetValue cmi.progress_measure=1']);
  });

  it('suspend() writes no status', () => {
    const s = make(); const mark = rec.calls.length;
    s.suspend();
    expect(rec.calls.slice(mark).filter((c) => /^SetValue cmi\.(completion_status|success_status|score\.|progress_measure)/.test(c))).toEqual([]);
  });
});
