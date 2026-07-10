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
    });
});
