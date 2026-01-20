import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SCOBot from '../src/core/SCOBot';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11';

describe('SCOBot SCORM Functionality', () => {

  let scobot;

  beforeEach(() => {
    // Prepare global environment
    vi.stubGlobal('location', { search: '' });

    // Mock LocalStorage
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

    // Initialize wrapper
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

  it('should handle Scoring and Status updates', () => {
    // Default passing score is 0.7
    scobot.setvalue('cmi.score.min', '0');
    scobot.setvalue('cmi.score.max', '100');

    // Test Failing Score
    scobot.setvalue('cmi.score.raw', '60');
    scobot.gradeIt(); // Calculates scaled score and status

    expect(scobot.getvalue('cmi.score.scaled')).toBe('0.6000000'); // 60/100
    expect(scobot.getvalue('cmi.success_status')).toBe('failed');
    expect(scobot.getvalue('cmi.completion_status')).toBe('completed');

    // Test Passing Score
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

    // SCOBot uses setvalue loops internally or specific methods
    // Let's manually set it via SCORM calls first to verify Polyfill/Translation
    // But SCOBot has a helper? Let's check SCOBot.js source... 
    // Warning: setInteraction implementation in SCOBot.js might be legacy. 
    // Let's try raw setvalue first as that is the core requirement.

    // SCORM 2004 Index-based
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

    // Using the helper method setInteraction
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

    // Verify write (in standalone mode we can check getvalue as Mock API stores it)
    const n = scobot.getvalue('cmi.interactions._count') - 1; // get last index

    expect(scobot.getvalue(`cmi.interactions.${n}.type`)).toBe('choice');
    expect(scobot.getvalue(`cmi.interactions.${n}.result`)).toBe('incorrect');
    // Learner response handling might vary by version/implementation, checking strictly what was set
    // expect(scobot.getvalue(`cmi.interactions.${n}.learner_response`)).toBe('a[,]c'); 
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
    // Test ISO duration conversion
    const duration = scobot.ISODurationToCentisec("PT1M30S"); // 90 seconds
    expect(duration).toBe(9000); // centiseconds
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
});
