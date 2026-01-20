import { describe, it, expect, beforeEach } from 'vitest';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11.js';

describe('SCOBot Mock Strictness', () => {
  let API;

  beforeEach(() => {
    API = new SCOBot_API_1484_11();
    API.Initialize("");
  });

  describe('Interactions - ID First Rule', () => {
    it('should fail if setting type before ID', () => {
      const result = API.SetValue("cmi.interactions.0.type", "true-false");
      expect(result).toBe("false");
      expect(API.GetLastError()).toBe(408); // Dependency not established
    });

    it('should succeed if setting ID first', () => {
      const result = API.SetValue("cmi.interactions.0.id", "int_1");
      expect(result).toBe("true");
      expect(API.GetLastError()).toBe(0);
    });

    it('should initialize sub-containers when ID is set', () => {
      API.SetValue("cmi.interactions.0.id", "int_1");
      // Check internal state
      expect(API.cmi.interactions[0].objectives._count).toBe("-1");
      expect(API.cmi.interactions[0].correct_responses._count).toBe("-1");
    });
  });

  describe('Objectives - Uniqueness', () => {
    it('should fail if duplicate top-level objective ID', () => {
      API.SetValue("cmi.objectives.0.id", "obj_1");
      const result = API.SetValue("cmi.objectives.1.id", "obj_1");
      expect(result).toBe("false");
      expect(API.GetLastError()).toBe(351); // General Set Failure
    });

    it('should allow unique IDs', () => {
      API.SetValue("cmi.objectives.0.id", "obj_1");
      const result = API.SetValue("cmi.objectives.1.id", "obj_2");
      expect(result).toBe("true");
    });
  });

  describe('Interaction Objectives - Uniqueness', () => {
    beforeEach(() => {
      API.SetValue("cmi.interactions.0.id", "int_1");
    });

    it('should fail if duplicate objective ID within interaction', () => {
      API.SetValue("cmi.interactions.0.objectives.0.id", "sub_obj_1");
      const result = API.SetValue("cmi.interactions.0.objectives.1.id", "sub_obj_1");
      expect(result).toBe("false");
      expect(API.GetLastError()).toBe(351);
    });
  });

  describe('Write Only Enforcement', () => {
    it('should fail to read cmi.exit', () => {
      const val = API.GetValue("cmi.exit");
      expect(val).toBe("false");
      expect(API.GetLastError()).toBe(405);
    });
  });
});
