import { describe, it, expect, beforeEach } from 'vitest';
import SCOBot from '../src/core/SCOBot.js';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11.js';

describe('Content API additions (5.2.0)', () => {
    let scobot;

    beforeEach(() => {
        document.body.innerHTML = '';
        window.API_1484_11 = undefined;
        window.API = undefined;
        window.API_1484_11 = new SCOBot_API_1484_11();
        scobot = new SCOBot();
        scobot.initSCO();
    });

    describe('Bookmarking', () => {
        it('setBookmark stores cmi.location and getBookmark returns it', () => {
            expect(scobot.setBookmark('page_4')).toBe('true');
            expect(scobot.getBookmark()).toBe('page_4');
            expect(scobot.getvalue('cmi.location')).toBe('page_4');
        });

        it('getBookmark returns empty string when never set', () => {
            expect(scobot.getBookmark()).toBe('');
        });

        it('setBookmark returns false when not connected', () => {
            scobot.terminate();
            expect(scobot.setBookmark('x')).toBe('false');
        });
    });

    describe('Session info', () => {
        it('getEntry returns the cmi.entry captured at start', () => {
            expect(typeof scobot.getEntry()).toBe('string');
            expect(['', 'ab-initio', 'resume']).toContain(scobot.getEntry());
        });

        it('getSecondsFromStart returns non-negative elapsed seconds', async () => {
            await new Promise((r) => setTimeout(r, 20));
            const s = scobot.getSecondsFromStart();
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThan(5);
        });

        it('getMode returns the cmi.mode captured at start', () => {
            // Mock default for cmi.mode is 'normal' (src/mocks/SCOBot_API_1484_11.js)
            expect(scobot.getMode()).toBe('normal');
        });
    });

    describe('getInteraction', () => {
        it('returns a previously set interaction by id (decoded)', () => {
            scobot.setInteraction({
                id: 'q1',
                type: 'choice',
                learner_response: ['a'],
                result: 'correct',
                weight: '1',
                timestamp: new Date().toISOString(),
                latency: 'PT5S'
            });
            const found = scobot.getInteraction('q1');
            expect(found).not.toBe('false');
            expect(found.id).toBe('q1');
            expect(found.type).toBe('choice');
            expect(found.result).toBe('correct');
        });

        it('returns false for an unknown id', () => {
            expect(scobot.getInteraction('nope')).toBe('false');
        });
    });

    describe('Scoring essence (restored from 4.x)', () => {
        const obj = (id) => ({
            id,
            score: { scaled: '1', raw: '1', min: '0', max: '1' },
            success_status: 'passed',
            completion_status: 'completed',
            progress_measure: '1',
            description: `Objective ${id}`
        });

        it('setTotals sets score bounds', () => {
            expect(scobot.setTotals({
                totalInteractions: '2', totalObjectives: '2', scoreMin: '0', scoreMax: '100'
            })).toBe('true');
            expect(scobot.getvalue('cmi.score.min')).toBe('0');
            expect(scobot.getvalue('cmi.score.max')).toBe('100');
        });

        it('setObjective maintains progress_measure against totalObjectives', () => {
            scobot.setTotals({ totalObjectives: '2', scoreMin: '0', scoreMax: '100' });
            scobot.setObjective(obj('obj1'));
            expect(parseFloat(scobot.getvalue('cmi.progress_measure'))).toBeCloseTo(0.5);
            scobot.setObjective(obj('obj2'));
            expect(parseFloat(scobot.getvalue('cmi.progress_measure'))).toBeCloseTo(1);
        });

        it('gradeIt gates completion on completion_threshold', () => {
            window.API_1484_11 = new SCOBot_API_1484_11();
            const sb = new SCOBot({ completion_threshold: 1 });
            sb.initSCO();
            sb.setTotals({ totalObjectives: '2', scoreMin: '0', scoreMax: '100' });
            sb.setObjective(obj('obj1'));
            sb.setvalue('cmi.score.raw', '50');
            sb.gradeIt();
            expect(sb.getvalue('cmi.completion_status')).toBe('incomplete');
            sb.setObjective(obj('obj2'));
            sb.gradeIt();
            expect(sb.getvalue('cmi.completion_status')).toBe('completed');
        });

        it('gradeIt rehydrates progress_measure from CMI on resume (regression: stale buffer after session 2 resume)', () => {
            // Session 1: learner answers every interactive page (both objectives complete
            // cmi.progress_measure -> 1.0), then suspends. The mock persists cmi to
            // localStorage on terminate/suspend, simulating a real LMS commit.
            localStorage.clear();
            window.API_1484_11 = new SCOBot_API_1484_11();
            const sbSession1 = new SCOBot();
            sbSession1.initSCO();
            sbSession1.setTotals({ totalObjectives: '2', scoreMin: '0', scoreMax: '100' });
            sbSession1.setObjective(obj('obj1'));
            sbSession1.setObjective(obj('obj2'));
            expect(sbSession1.getvalue('cmi.progress_measure')).toBe('1');
            sbSession1.setvalue('cmi.score.raw', '100');
            sbSession1.suspend(); // persists cmi (incl. progress_measure) via the mock's localStorage store

            // Session 2: a brand-new page load / brand-new SCOBot + mock instance resumes
            // from the persisted cmi. The learner finishes via a NON-interactive page, so
            // setObjective never fires -- this.buffer.progress_measure stays at its "0"
            // construction default because start() never rehydrates it from CMI.
            window.API_1484_11 = new SCOBot_API_1484_11();
            const sbSession2 = new SCOBot();
            sbSession2.initSCO();
            expect(sbSession2.getEntry()).toBe('resume'); // sanity: mock recognizes the suspended session
            sbSession2.setvalue('cmi.score.raw', '100');
            sbSession2.gradeIt(); // no setObjective call in this session

            // gradeIt must consult the authoritative CMI value (persisted "1"), not the
            // stale in-memory buffer default ("0"), or the learner gets no credit.
            expect(sbSession2.getvalue('cmi.completion_status')).toBe('completed');
        });
    });

    describe('Lifecycle guards (regression: bare this.isActive was always truthy)', () => {
        it('suspend after terminate returns false and does not write cmi.exit', () => {
            // scobot was initSCO'd in beforeEach; end the session.
            scobot.setvalue('cmi.exit', 'normal');
            expect(scobot.terminate()).toBe('true');
            const exitBefore = window.API_1484_11.cmi.exit;

            // A terminated session must refuse to suspend. Before the fix, suspend()'s
            // `if (this.isActive)` referenced the inherited isActive METHOD without
            // calling it -- a function object is always truthy -- so it proceeded to
            // setvalue('cmi.exit', 'suspend') against a dead connection.
            expect(scobot.suspend()).toBe('false');
            expect(window.API_1484_11.cmi.exit).toBe(exitBefore);
        });

        it('setObjective after terminate returns false', () => {
            expect(scobot.terminate()).toBe('true');
            // Same bare `this.isActive` bug class: pre-fix, setObjective fell through
            // the guard and ground through CMI calls against a dead connection.
            expect(scobot.setObjective({
                id: 'obj-dead',
                score: { scaled: '1', raw: '1', min: '0', max: '1' },
                success_status: 'passed',
                completion_status: 'completed',
                progress_measure: '1',
                description: 'Written after terminate'
            })).toBe('false');
        });
    });
});
