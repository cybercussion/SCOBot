import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SCOBot from '../src/core/SCOBot';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11';

describe('SCOBot Modernization', () => {

  beforeEach(() => {
    // Mock window and localStorage
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize Mock API and persist data', () => {
    const mockAPI = new SCOBot_API_1484_11();
    expect(mockAPI.Initialize()).toBe('true');

    mockAPI.SetValue('cmi.suspend_data', 'test_data');
    mockAPI.Commit();

    expect(mockAPI.GetValue('cmi.suspend_data')).toBe('test_data');

    // Verify Persistence
    const stored = JSON.parse(localStorage.getItem('SCOBot_Mock_Data'));
    expect(stored.cmi.suspend_data).toBe('test_data');
  });

  it('should initialize SCOBot in standalone mode', () => {
    // Setup Standalone Mode
    const bot = new SCOBot({
      use_standalone: true,
      debug: true
    });

    // It should verify that it couldn't find a parent API, so it creates one
    // Note: In JSDOM, window.parent === window usually, unless configured otherwise.
    // SCOBotBase Checks:
    // if (window.parent && window.parent !== window) ...
    // if (!this.API.path) ... creates new SCOBot_API_1484_11

    expect(bot.API.connection).toBe(true);
    expect(bot.API.version).toBe("2004"); // Default mock version
    expect(bot.settings.standalone).toBe(true);
  });

  it('should set and get values via SCOBot', () => {
    const bot = new SCOBot({ use_standalone: true });
    bot.initialize(); // Connect to Mock API

    bot.setvalue('cmi.location', 'page_1');
    bot.setvalue('cmi.suspend_data', 'some_data');

    expect(bot.getvalue('cmi.location')).toBe('page_1');
    expect(bot.getvalue('cmi.suspend_data')).toBe('some_data');
  });

  it('should compress suspend_data if enabled', () => {
    const bot = new SCOBot({
      use_standalone: true,
      compression: true
    });
    bot.initialize();

    const bigData = { foo: 'bar'.repeat(100) };
    bot.settings.suspend_data = bigData;

    bot.setSuspendData();

    // internal check
    const raw = bot.getvalue('cmi.suspend_data');
    expect(raw).not.toBe(JSON.stringify(bigData)); // Should be compressed string
    expect(raw).not.toContain('foo'); // Compressed shouldn't have plain text
  });
});
