import { describe, it, expect, beforeEach, vi } from 'vitest';
import SCOBot from '../src/core/SCOBot.js';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11.js';

describe('SCOBot Interaction Logic', () => {
  let scobot;
  let mockAPI;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    window.API_1484_11 = undefined;
    window.API = undefined;

    // Setup SCORM 2004 Mock
    mockAPI = new SCOBot_API_1484_11();
    window.API_1484_11 = mockAPI;

    scobot = new SCOBot();
    scobot.initSCO();
  });

  describe('Helper Methods', () => {
    it('should identify bad values', () => {
      expect(scobot.isBadValue(null)).toBe(true);
      expect(scobot.isBadValue(undefined)).toBe(true);
      expect(scobot.isBadValue('NaN')).toBe(true);
      expect(scobot.isBadValue('')).toBe(true);
      expect(scobot.isBadValue('valid')).toBe(false);
    });

    it('should round correctly', () => {
      // toPrecision(7) on 10.12345678 (2 digits left of decimal) results in 10.12346 (7 sig figs)
      expect(scobot.trueRound(10.12345678, 7)).toBe(10.12346);
      expect(scobot.trueRound(10.1, 2)).toBe(10);
    });

    it('should identify ISO8601 Duration', () => {
      expect(scobot.isISO8601Duration('PT1H30M')).toBe(true);
      expect(scobot.isISO8601Duration('P1DT1H')).toBe(true);
      expect(scobot.isISO8601Duration('01:30:00')).toBe(false);
    });
  });

  describe('Interaction Encoding (SCORM 2004)', () => {
    it('should encode matching interaction (2004)', () => {
      // source[.]target[,]source[.]target
      const data = [['tile1', 'target1'], ['tile2', 'target2']];
      const encoded = scobot.encodeInteractionType('matching', data);
      expect(encoded).toBe('tile1[.]target1[,]tile2[.]target2');
    });

    it('should encode sequencing interaction (2004)', () => {
      // step1[,]step2
      const data = ['step1', 'step2'];
      const encoded = scobot.encodeInteractionType('sequencing', data);
      expect(encoded).toBe('step1[,]step2');
    });

    it('should encode performance interaction (2004)', () => {
      // step1[.]value[,]step2[.]value
      const data = [['step1', 'val1'], ['step2', 'val2']];
      const encoded = scobot.encodeInteractionType('performance', data);
      expect(encoded).toBe('step1[.]val1[,]step2[.]val2');
    });

    it('should encode fill-in with metadata (2004)', () => {
      const data = {
        case_matters: true,
        lang: 'en',
        words: ['word1', 'word2']
      };
      const encoded = scobot.encodeInteractionType('fill-in', data);
      expect(encoded).toContain('{case_matters=true}');
      expect(encoded).toContain('{lang=en}');
      expect(encoded).toContain('word1[,]word2');
    });

    it('should encode numeric range (2004)', () => {
      const data = { min: 0, max: 100 };
      const encoded = scobot.encodeInteractionType('numeric', data);
      expect(encoded).toBe('0[:]100');
    });
  });

  describe('Interaction Decoding (SCORM 2004)', () => {
    it('should decode matching interaction', () => {
      const str = 'tile1[.]target1[,]tile2[.]target2';
      const decoded = scobot.decodeInteractionType('matching', str);
      expect(decoded).toEqual([['tile1', 'target1'], ['tile2', 'target2']]);
    });

    it('should decode fill-in metadata', () => {
      const str = '{case_matters=true}{lang=en}word1[,]word2';
      const decoded = scobot.decodeInteractionType('fill-in', str);
      expect(decoded.case_matters).toBe('true');
      expect(decoded.lang).toBe('en');
      expect(decoded.words).toEqual(['word1', 'word2']);
    });
  });
});

describe('SCOBot Interaction Logic (SCORM 1.2)', () => {
  let scobot;
  // We need a partial Mock 1.2 just to trick the version getter
  // But SCOBot.js relies on this.API.version which comes from detected API.
  // simpler to just mock the getter directly on the instance for this specific test
  // or setup the MockAPI_12.

  beforeEach(() => {
    // Setup SCORM 1.2 "Mode" by mocking getAPIVersion on the instance
    // But we need a valid scobot instance first.
    window.API_1484_11 = new SCOBot_API_1484_11(); // Standard init
    scobot = new SCOBot();
    scobot.initSCO();

    // Force version override
    vi.spyOn(scobot, 'getAPIVersion').mockReturnValue('1.2');
  });

  it('should encode matching interaction (1.2)', () => {
    // source.target,source.target
    const data = [['tile1', 'target1'], ['tile2', 'target2']];
    const encoded = scobot.encodeInteractionType('matching', data);
    expect(encoded).toBe('tile1.target1,tile2.target2');
  });

  it('should encode sequencing interaction (1.2)', () => {
    // step1,step2
    const data = ['step1', 'step2'];
    const encoded = scobot.encodeInteractionType('sequencing', data);
    expect(encoded).toBe('step1,step2');
  });

  it('should map true-false values (1.2)', () => {
    expect(scobot.encodeInteractionType('true-false', true)).toBe('t');
    expect(scobot.encodeInteractionType('true-false', false)).toBe('f');
  });
});
