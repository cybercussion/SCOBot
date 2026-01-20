import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SCOBot from '../src/core/SCOBot';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11';

describe('SCOBot SCORM 2004 Functionality', () => {

  let scobot;

  beforeEach(() => {
    vi.stubGlobal('location', { search: '' });

    const localStorageMock = (function () {
      let store = {};
      return {
        getItem: function (key) { return store[key] || null; },
        setItem: function (key, value) { store[key] = value.toString(); },
        clear: function () { store = {}; },
        removeItem: function (key) { delete store[key]; }
      };
    })();
    vi.stubGlobal('localStorage', localStorageMock);

    // Default to standalone (uses Mock 1484_11 internally)
    scobot = new SCOBot({
      use_standalone: true,
      debug: false
    });
    scobot.initialize();
  });

  afterEach(() => {
    scobot.terminate();
    vi.restoreAllMocks();
  });

  it('should detect SCORM 2004 environment', () => {
    // In standalone, it defaults to 2004
    expect(scobot.getAPIVersion()).toBe("2004");
  });

  it('should handle Scoring and Status updates', () => {
    scobot.setvalue('cmi.score.min', '0');
    scobot.setvalue('cmi.score.max', '100');
    scobot.setvalue('cmi.score.raw', '80');
    scobot.gradeIt();
    expect(scobot.getvalue('cmi.score.scaled')).toBe('0.8000000');
    expect(scobot.getvalue('cmi.success_status')).toBe('passed');
  });

  it('should record Interactions', () => {
    const interactionData = {
      id: 'question_1',
      type: 'choice',
      learner_response: 'b',
      correct_responses: 'b',
      result: 'correct',
      latency: 'PT0H0M5S', // 5 seconds
      description: 'Question 1 text'
    };

    const idx = 0;
    scobot.setvalue(`cmi.interactions.${idx}.id`, interactionData.id);
    scobot.setvalue(`cmi.interactions.${idx}.type`, interactionData.type);
    scobot.setvalue(`cmi.interactions.${idx}.learner_response`, interactionData.learner_response);
    scobot.setvalue(`cmi.interactions.${idx}.result`, interactionData.result);

    expect(scobot.getvalue(`cmi.interactions.${idx}.id`)).toBe('question_1');
    expect(scobot.getvalue(`cmi.interactions.${idx}.result`)).toBe('correct');
  });

  it('should handle Multiple Choice Interactions (choice)', () => {
    const intID = '2';
    const objID = '2_1';
    scobot.setInteraction({
      id: intID,
      type: 'choice',
      objectives: [{ id: objID }],
      timestamp: new Date().toISOString(),
      correct_responses: [{ pattern: ["a", "b"] }],
      weighting: '1',
      learner_response: ["a", "c"],
      result: 'incorrect',
      latency: 'PT5M',
      description: 'Which choices would you pick?'
    });

    const n = scobot.getvalue('cmi.interactions._count') - 1;
    expect(scobot.getvalue(`cmi.interactions.${n}.type`)).toBe('choice');
    expect(scobot.getvalue(`cmi.interactions.${n}.result`)).toBe('incorrect');
  });

  it('should handle Sequencing Interactions', () => {
    const intID = '4';
    scobot.setInteraction({
      id: intID,
      type: 'sequencing',
      timestamp: new Date().toISOString(),
      correct_responses: [{ pattern: ["c", "b", "a"] }],
      learner_response: ["a", "c", "b"],
      result: 'incorrect',
      description: 'Order these items'
    });
    const n = scobot.getvalue('cmi.interactions._count') - 1;
    expect(scobot.getvalue(`cmi.interactions.${n}.type`)).toBe('sequencing');
  });

  it('should handle Time and Date conversions', () => {
    const duration = scobot.ISODurationToCentisec("PT1M30S");
    expect(duration).toBe(9000);
  });

  it('should record Objectives', () => {
    const idx = 0;
    const objectiveID = 'obj_module_1';
    scobot.setvalue(`cmi.objectives.${idx}.id`, objectiveID);
    scobot.setvalue(`cmi.objectives.${idx}.score.scaled`, '0.95');
    scobot.setvalue(`cmi.objectives.${idx}.success_status`, 'passed');
    scobot.setvalue(`cmi.objectives.${idx}.completion_status`, 'completed');

    expect(scobot.getvalue(`cmi.objectives.${idx}.id`)).toBe(objectiveID);
    expect(scobot.getvalue(`cmi.objectives.${idx}.success_status`)).toBe('passed');
    expect(scobot.getvalue(`cmi.objectives.${idx}.score.scaled`)).toBe('0.95');
  });

  it('should persist data via Commit', () => {
    scobot.setvalue('cmi.location', 'slide_10');
    scobot.commit();
    const stored = JSON.parse(localStorage.getItem('SCOBot_Mock_Data'));
    expect(stored.cmi.location).toBe('slide_10');
  });

  // New Legacy Helpers (which also work in 2004)
  it('should handle Legacy Search Helpers in 2004 Mode', () => {
    scobot.setvalue('cmi.objectives.0.id', 'obj_1');
    scobot.setvalue('cmi.interactions.0.id', 'int_1');

    expect(scobot.getObjectiveByID('obj_1')).toBe(0);
    expect(scobot.getInteractionByID('int_1')).toBe(0);
  });

  it('should calculate Latency average', () => {
    scobot.settings.latency_arr = [{ lat: 100 }, { lat: 300 }];
    expect(scobot.checkLatency()).toBe("200.00");
  });
});
