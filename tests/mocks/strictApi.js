// A recording SCORM 2004 API that answers per the SPEC for the codes these tests pin: status vocabularies
// and real-number elements reject with 406. NOTE: this is stricter than scobotrte v4.1.6, which accepts
// non-numeric cmi.score.raw|min|max (a runtime defect reported separately); the spec (RTE 4th Ed p.177,
// RTE-4-117) says a non-real value must give 406, return false, and leave the element unchanged.
export function strictApi2004({ store = {} } = {}) {
  const calls = [], errors = [];
  let state = 'new', err = '0';
  const data = { 'cmi.completion_status': 'unknown', 'cmi.success_status': 'unknown', 'cmi.entry': 'ab-initio',
    'cmi.mode': 'normal', 'cmi.location': '', 'cmi.suspend_data': '', ...store };
  const fail = (code) => { err = code; errors.push(code); return 'false'; };
  const ok = (v = 'true') => { err = '0'; return v; };
  const VOCAB = { 'cmi.success_status': ['passed', 'failed', 'unknown'],
    'cmi.completion_status': ['completed', 'incomplete', 'not attempted', 'unknown'] };
  const REALS = ['cmi.score.scaled', 'cmi.score.raw', 'cmi.score.min', 'cmi.score.max', 'cmi.progress_measure'];
  const api = {
    Initialize: () => { calls.push('Initialize');
      if (state === 'terminated') return fail('104'); if (state === 'running') return fail('103');
      state = 'running'; return ok(); },
    Terminate: () => { calls.push('Terminate'); if (state !== 'running') return fail(state === 'new' ? '112' : '113'); state = 'terminated'; return ok(); },
    Commit: () => { calls.push('Commit'); return state === 'running' ? ok() : fail(state === 'new' ? '142' : '143'); },
    GetValue: (k) => { if (state !== 'running') { fail(state === 'new' ? '122' : '123'); return ''; }
      if (k in data && data[k] !== '') return ok(data[k]); fail('403'); return ''; },
    SetValue: (k, v) => { calls.push(`SetValue ${k}=${v}`); if (state !== 'running') return fail(state === 'new' ? '132' : '133');
      if (VOCAB[k] && !VOCAB[k].includes(v)) return fail('406');
      if (REALS.includes(k) && (String(v).trim() === '' || !Number.isFinite(Number(v)))) return fail('406');
      data[k] = String(v); return ok(); },
    GetLastError: () => err, GetErrorString: () => '', GetDiagnostic: () => ''
  };
  return { api, calls, errors, data };
}

// A recording SCORM 1.2 API with the scobotrte 1.2 runtime's codes: 103 re-init, 104 init after finish,
// 301 before init, 101 after termination.
export function strictApi12({ store = {} } = {}) {
  const calls = [], errors = [];
  let state = 'new', err = '0';
  const data = { 'cmi.core.lesson_status': 'not attempted', 'cmi.core.entry': 'ab-initio', ...store };
  const fail = (code) => { err = code; errors.push(code); return 'false'; };
  const ok = (v = 'true') => { err = '0'; return v; };
  const SCORES12 = ['cmi.core.score.raw', 'cmi.core.score.min', 'cmi.core.score.max'];
  const notRunning = () => fail(state === 'new' ? '301' : '101');
  const api = {
    LMSInitialize: () => { calls.push('LMSInitialize');
      if (state === 'terminated') return fail('104'); if (state === 'running') return fail('103');
      state = 'running'; return ok(); },
    LMSFinish: () => { calls.push('LMSFinish'); if (state !== 'running') return notRunning(); state = 'terminated'; return ok(); },
    LMSCommit: () => { calls.push('LMSCommit'); return state === 'running' ? ok() : notRunning(); },
    LMSGetValue: (k) => { if (state !== 'running') { notRunning(); return ''; }
      if (k in data) return ok(data[k]); return ok(''); },
    LMSSetValue: (k, v) => { calls.push(`LMSSetValue ${k}=${v}`); if (state !== 'running') return notRunning();
      // CMIDecimal (1.2 allows CMIBlank '' only): anything else non-numeric is 405 (type mismatch).
      if (SCORES12.includes(k) && String(v) !== '' && (String(v).trim() === '' || !Number.isFinite(Number(v)))) return fail('405');
      data[k] = String(v); return ok(); },
    LMSGetLastError: () => err, LMSGetErrorString: () => '', LMSGetDiagnostic: () => ''
  };
  return { api, calls, errors, data };
}
