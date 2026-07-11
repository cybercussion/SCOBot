# SCOBOT.md — Agent Integration Contract

You are integrating SCORM tracking via **`@cybercussion/scobot` 5.2.x**. This
is the runtime-neutral contract for that integration — it works with any
coding agent (Claude Code, Codex, Cursor, Gemini CLI, aider, …) or by hand.
The library does the SCORM 1.2 ↔ 2004 bridging; you drive it through the
Content API in the sequence below. Never touch `cmi.*` strings directly
except via `setvalue`/`getvalue` for fields the Content API doesn't wrap.

## The canonical sequence

1. **Construct.** Real option keys only — see `scoBotDefaults` in
   `src/core/SCOBot.js` and the base defaults in
   `src/connector/SCOBotBase.js`. Do not invent option names.

   ```js
   import { SCOBot } from '@cybercussion/scobot';

   const scobot = new SCOBot({
       debug: true,                  // console logging
       use_standalone: true,         // localStorage mock when no LMS API is found
       compression: true,            // lz-string on suspend_data
       exit_type: 'suspend',         // 'finish' | 'suspend' | 'timeout'
       scaled_passing_score: 0.7,    // default 0.7
       completion_threshold: 0       // default 0; LMS-declared value wins if set
   });
   ```

2. **Connect.** `initSCO()` = `initialize()` + `start()` in one call: finds
   (or mocks) the runtime API, reads `cmi.mode`/`cmi.entry`, restores
   suspend data, applies `completion_threshold`.

   ```js
   scobot.initSCO(); // 'true' | 'false'
   ```

3. **Guard for review mode — YOU do this, the library does not.**
   `getMode()` returns `'normal' | 'browse' | 'review'`. `setvalue` and every
   Content API write method (`setInteraction`, `setObjective`, `setTotals`,
   `setBookmark`, `setSuspendData*`, `gradeIt`, `finish`, `suspend`) call
   straight through to the runtime API with **no mode check** — SCOBot 5.x
   does not block writes for you. If `getMode() === 'review'`, skip every
   write call in your own code; reads (`getvalue`, `getBookmark`,
   `getInteraction`, `getObjective`) are always safe.

   ```js
   const canWrite = scobot.getMode() !== 'review';
   const entry = scobot.getEntry(); // '' | 'ab-initio' | 'resume'
   ```

4. **Declare totals once**, right after `initSCO()`, before any interaction
   or objective writes. This is what lets `setObjective` maintain
   `cmi.progress_measure` and what `gradeIt()` reads score min/max from.

   ```js
   scobot.setTotals({
       totalInteractions: '3',
       totalObjectives: '3',
       scoreMin: '0',
       scoreMax: '100'
   });
   ```

5. **Bookmark + per-unit suspend state**, on every page/unit boundary.

   ```js
   scobot.setBookmark('page_5');
   scobot.setSuspendDataByPageID('page_5', 'Quiz Page', { answered: true, choice: 'b' });
   // resume: scobot.getBookmark() / scobot.getSuspendDataByPageID('page_5')
   ```

6. **Record each question** — interaction AND its objective, both, every
   time. `setObjective` is **not a partial update**: any omitted field other
   than `score` (`success_status`, `completion_status`, `progress_measure`,
   `description`) is written as the literal string `"undefined"` because the
   method passes `data.<field>` straight to `setvalue` with no presence
   check. Always send the full payload.

   ```js
   scobot.setInteraction({
       id: 'q1',
       type: 'choice',              // true-false | choice | matching | fill-in | performance | ...
       learner_response: ['b'],
       result: 'correct',
       weighting: '1',              // write key is 'weighting'; getInteraction() returns it as 'weight'
       timestamp: new Date().toISOString(),
       latency: 'PT12S'
   });

   scobot.setObjective({
       id: 'q1',
       score: { scaled: '1', raw: '1', min: '0', max: '1' },
       success_status: 'passed',
       completion_status: 'completed',
       progress_measure: '1',
       description: 'Question 1'
   });
   // read back: scobot.getInteraction('q1') / scobot.getObjective('q1')
   ```

7. **Grade at completion.** `gradeIt()` reads `cmi.score.raw`/`min`/`max`
   (from step 4 + this write) and derives `cmi.score.scaled` +
   `success_status`, gating completion on `completion_threshold`.

   ```js
   scobot.setvalue('cmi.score.raw', '90');
   scobot.gradeIt();
   ```

8. **End the attempt.** `finish()` sets `cmi.exit = 'normal'`, finalizes
   status, and terminates the session — the attempt is over. `suspend()`
   sets `cmi.exit = 'suspend'` and terminates without finalizing status —
   the learner can resume later via `getEntry() === 'resume'`. Pick one; do
   not call both.

   ```js
   scobot.finish();   // attempt complete
   // — or —
   scobot.suspend();  // save progress, resume next launch
   ```

## Tripwires

- **Strings only.** Every `cmi.*` value is a string. `setvalue('cmi.score.raw', 90)`
  (a number) fails silently at the runtime API boundary — always
  `'' + value` or a template literal.
- **Never fabricate answer keys, correct-response patterns, or interaction
  IDs.** If the course content doesn't hand you a real answer key, stop and
  ask; a plausible-looking invented key is the one unforgivable move here.
- **Review mode writes nothing — you enforce it.** See step 3. Nothing in
  the library stops a `setInteraction` call from succeeding in review mode.
- **`weighting` in, `weight` out.** `setInteraction({ weighting: '1' })` on
  write; `getInteraction(id).weight` on read. Same field, different key —
  do not mix them up in either direction.
- **Interaction timestamps are real `Date`/ISO8601, not clock strings.**
  Pass `timestamp` as an ISO 8601 string or `Date` object; `latency` as a
  `Date` (SCOBot computes the delta) or a pre-formatted ISO 8601 duration
  (`PT12S`). Malformed latency strings do not throw — they persist as-is.
  (≤5.2.1 silently overwrites supplied latency with an auto-calculation when
  `learner_response` is present — fixed after 5.2.1; on affected versions
  omit `latency` and let SCOBot compute it from your `timestamp`.)
- **`isLMSConnected()` ≠ `isConnectionActive()`.** `isLMSConnected()`
  reports whether a runtime API (real or standalone mock) was ever found
  (`API.connection`). `isConnectionActive()` reports whether the session is
  currently live between `initialize()` and `terminate()`
  (`API.isActive`) — this is the one every Content API write method gates
  on internally. Use `isConnectionActive()` before manual `setvalue` calls
  outside the Content API.
- **`suspend_data` has hard size ceilings**: 4096 chars under SCORM 1.2,
  64000 under 2004 — the library logs a debug warning past either limit but
  does not truncate for you. Use `compression: true` (lz-string) before you
  hit them, especially with `setSuspendDataByPageID` accumulating pages
  across a long course.
- **Never invent legacy suspend_data shapes.** The 5.x shape is
  `{ pages: [{ id, title, data }] }`, managed entirely through
  `setSuspendDataByPageID`/`getSuspendDataByPageID`. Don't hand-roll the
  JSON structure.

## Developing without an LMS

Set `use_standalone: true`. When no runtime API is found in the window
hierarchy, SCOBot falls back to a mock `API_1484_11` implementation backed
by `localStorage` (`SCOBot_Mock_Data` key) — the full Content API sequence
above works unchanged, state persists across reloads, and no LMS is
required for the dev loop.

## Pointers

- **Core API reference & lifecycle**: the
  [SCOBot wiki](https://github.com/cybercussion/SCOBot/wiki) —
  `SCORM-SCOBot-Documentation`, `Lifecycle-and-Sessions`,
  `Status-Scoring-and-Progress` pages cover this contract in prose depth.
- **Reference consumer**: [SCOBot_README.md](https://github.com/cybercussion/axiom/blob/scobot-player2/SCOBot_README.md)
  in the `axiom` repo's `scobot-player2` branch — a full player wired to
  this exact sequence, including the review-mode guard pattern.
- **[SCOBot Packager](https://cybercussion.com/scobot/packager)** — Rust
  multi-platform content packager with a built-in LMS previewer: bundle and
  test against real SCORM Runtime APIs locally.
- **[scobot.cybercussion.com](https://scobot.cybercussion.com)** — the LMS:
  upload a package and verify bookmark/resume, interactions, objectives,
  and score/completion against a real runtime.
- **[npm: @cybercussion/scobot](https://www.npmjs.com/package/@cybercussion/scobot)**
  — the package itself.
