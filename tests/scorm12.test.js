import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SCOBot from '../src/core/SCOBot';
import MockAPI_12 from './mocks/MockAPI_12';

describe('SCOBot SCORM 1.2 Mapping Functionality', () => {

  let scobot;
  let mockAPI;

  beforeEach(() => {
    // Inject Mock API 1.2
    mockAPI = new MockAPI_12();
    vi.stubGlobal('API', mockAPI);
    vi.stubGlobal('location', { search: '' });

    // Initialize SCOBot (auto-detects window.API)
    scobot = new SCOBot({
      debug: false,
      use_standalone: false // We are "connected" to window.API
    });
    scobot.initialize();
  });

  afterEach(() => {
    scobot.terminate();
    vi.restoreAllMocks();
  });

  it('should detect SCORM 1.2 environment', () => {
    expect(scobot.getAPIVersion()).toBe("1.2");
    expect(scobot.isLMSConnected()).toBe(true);
  });

  it('should map SCORM 2004 keys to SCORM 1.2 keys on SetValue', () => {
    // 2004 Key -> 1.2 Key
    scobot.setvalue('cmi.location', 'slide_5');
    expect(mockAPI.LMSGetValue('cmi.core.lesson_location')).toBe('slide_5');

    scobot.setvalue('cmi.score.raw', '85');
    expect(mockAPI.LMSGetValue('cmi.core.score.raw')).toBe('85');

    scobot.setvalue('cmi.exit', 'suspend');
    expect(mockAPI.LMSGetValue('cmi.core.exit')).toBe('suspend');

    // Check "normal" exit translation
    scobot.setvalue('cmi.exit', 'normal');
    expect(mockAPI.LMSGetValue('cmi.core.exit')).toBe('');
  });

  it('should map SCORM 2004 keys to SCORM 1.2 keys on GetValue', () => {
    // Pre-seed mock data
    mockAPI.LMSSetValue('cmi.core.student_name', 'Doe, John');

    // Get using 2004 key
    const name = scobot.getvalue('cmi.learner_name');
    expect(name).toBe('Doe, John');
  });

  it('should map Learner Preferences', () => {
    scobot.setvalue('cmi.learner_preferences.audio_level', '5');
    expect(mockAPI.LMSGetValue('cmi.student_preferences.audio')).toBe('5');

    scobot.setvalue('cmi.learner_preferences.language', 'en');
    expect(mockAPI.LMSGetValue('cmi.student_preferences.language')).toBe('en');
  });

  it('should consolidate Objective Status', () => {
    // 2004 has success_status AND completion_status
    // 1.2 only has status (passed, completed, failed, incomplete, browsed, not attempted)

    // Case 1: success_status -> status
    scobot.setvalue('cmi.objectives.0.id', 'obj_1');
    scobot.setvalue('cmi.objectives.0.success_status', 'passed');

    expect(mockAPI.LMSGetValue('cmi.objectives.0.id')).toBe('obj_1');
    expect(mockAPI.LMSGetValue('cmi.objectives.0.status')).toBe('passed');

    // Case 2: completion_status -> status
    scobot.setvalue('cmi.objectives.1.id', 'obj_2');
    scobot.setvalue('cmi.objectives.1.completion_status', 'incomplete');

    expect(mockAPI.LMSGetValue('cmi.objectives.1.id')).toBe('obj_2');
    expect(mockAPI.LMSGetValue('cmi.objectives.1.status')).toBe('incomplete');

    // Case 3: unknown -> not attempted
    scobot.setvalue('cmi.objectives.2.id', 'obj_3');
    scobot.setvalue('cmi.objectives.2.completion_status', 'unknown');
    expect(mockAPI.LMSGetValue('cmi.objectives.2.status')).toBe('not attempted');
  });

  it('should map Interactions', () => {
    // 2004 -> 1.2
    // timestamp -> time
    // learner_response -> student_response
    // result "incorrect" -> "wrong"

    scobot.setvalue('cmi.interactions.0.id', 'int_1');
    scobot.setvalue('cmi.interactions.0.timestamp', '12:00:00');
    scobot.setvalue('cmi.interactions.0.learner_response', 'a');
    scobot.setvalue('cmi.interactions.0.result', 'incorrect');

    expect(mockAPI.LMSGetValue('cmi.interactions.0.id')).toBe('int_1');
    expect(mockAPI.LMSGetValue('cmi.interactions.0.time')).toBe('12:00:00');
    expect(mockAPI.LMSGetValue('cmi.interactions.0.student_response')).toBe('a');
    expect(mockAPI.LMSGetValue('cmi.interactions.0.result')).toBe('wrong');
  });

  it('should round-trip an interaction through setInteraction/getInteraction (1.2)', () => {
    scobot.setInteraction({
      id: 'q1_12',
      type: 'choice',
      learner_response: ['a'],
      result: 'correct',
      timestamp: new Date()
    });
    const found = scobot.getInteraction('q1_12');
    expect(found).not.toBe('false');
    expect(found.id).toBe('q1_12');
    expect(found.result).toBe('correct');
  });
});
