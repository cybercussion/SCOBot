import { describe, it, expect } from 'vitest';
import { strictApi2004, strictApi12 } from './mocks/strictApi.js';

describe('strictApi2004 rejects non-real numeric values (RTE 4th Ed p.177)', () => {
  for (const k of ['cmi.score.scaled', 'cmi.score.raw', 'cmi.score.min', 'cmi.score.max', 'cmi.progress_measure']) {
    for (const bad of ['NaN', 'abc', '  ', '']) {
      it(`${k}=${JSON.stringify(bad)} -> false/406, not stored`, () => {
        const { api, errors, data } = strictApi2004();
        api.Initialize('');
        expect(api.SetValue(k, bad)).toBe('false');
        expect(api.GetLastError()).toBe('406');
        expect(errors).toEqual(['406']);
        expect(k in data).toBe(false);
      });
    }
    it(`${k}=0.5 is accepted`, () => {
      const { api, data } = strictApi2004();
      api.Initialize('');
      expect(api.SetValue(k, '0.5')).toBe('true');
      expect(data[k]).toBe('0.5');
    });
  }
});

describe('strictApi12 rejects non-numeric scores', () => {
  for (const k of ['cmi.core.score.raw', 'cmi.core.score.min', 'cmi.core.score.max']) {
    for (const bad of ['NaN', 'abc', 'x', '  ']) {
      it(`${k}=${JSON.stringify(bad)} -> false/405, not stored`, () => {
        const { api, errors, data } = strictApi12();
        api.LMSInitialize('');
        expect(api.LMSSetValue(k, bad)).toBe('false');
        expect(api.LMSGetLastError()).toBe('405');
        expect(errors).toEqual(['405']);
        expect(k in data).toBe(false);
      });
    }
    it(`${k} accepts '' (CMIBlank) and 85`, () => {
      const { api, errors } = strictApi12();
      api.LMSInitialize('');
      expect(api.LMSSetValue(k, '')).toBe('true');
      expect(api.LMSSetValue(k, '85')).toBe('true');
      expect(errors).toEqual([]);
    });
  }
});
