import { describe, it, expect } from 'vitest';
import SCOBotBase from '../src/connector/SCOBotBase';

// CMITimespan per SCORM 1.2: HHHH:MM:SS(.SS) — hours 2-4 digits, minutes/seconds
// exactly 2, optional 1-2 decimal digits. Same grammar the SCOBot RTE (scobotrte
// v2.1.11+) enforces on cmi.core.session_time with a 405 on mismatch.
const CMI_TIMESPAN = /^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/;

// Pure function of n — no instance state, callable off the prototype.
const toDuration = (n) => SCOBotBase.prototype.centisecsToSCORM12Duration(n);

describe('centisecsToSCORM12Duration (CMITimespan output)', () => {

  it('carries centisecond round-up into seconds instead of emitting .100', () => {
    // Elapsed 12999ms as commit() computes it: (ms / 1000) * 100 centisecs.
    // 1299.9 centisecs rounds to 1300 → 13 seconds even, NOT 12.100.
    expect(toDuration((12999 / 1000) * 100)).toBe('0000:00:13.00');
  });

  it('carries through minute and hour boundaries', () => {
    expect(toDuration((59999 / 1000) * 100)).toBe('0000:01:00.00');
    expect(toDuration((3599995 / 1000) * 100)).toBe('0001:00:00.00');
  });

  it('emits valid CMITimespan across the .995-.999ms rounding band', () => {
    [12995, 12996, 12997, 12998, 12999, 59999, 3599995].forEach((ms) => {
      const out = toDuration((ms / 1000) * 100);
      expect(out).toMatch(CMI_TIMESPAN);
    });
  });

  it('leaves ordinary values unchanged', () => {
    expect(toDuration((12345 / 1000) * 100)).toBe('0000:00:12.35');
    expect(toDuration((500 / 1000) * 100)).toBe('0000:00:00.50');
    expect(toDuration((60000 / 1000) * 100)).toBe('0000:01:00.00');
    expect(toDuration(0)).toBe('0000:00:00.00');
  });
});
