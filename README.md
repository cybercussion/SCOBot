# SCOBot - Modern SCORM Library for Content Creation
[![CI](https://github.com/cybercussion/SCOBot/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cybercussion/SCOBot/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-5.2.3-blue)]()
[![License](https://img.shields.io/badge/license-CC--BY--SA--4.0-orange)]()

![logo](https://content.cybercussion.com/css/img/cybercussion_logo_black_sm.png)

**Links:** [SCOBot Platform](https://scobot.cybercussion.com) · [SCOBot at Cybercussion](https://cybercussion.com/scobot) · [Documentation Wiki](https://github.com/cybercussion/SCOBot/wiki) · [SCOBOT.md](SCOBOT.md) (agent integration contract)

## Overview
**SCOBot 5** is a modernized, native JavaScript library for SCORM 1.2 and 2004 (2nd, 3rd, 4th Edition). It simplifies the complexity of the SCORM Run-Time Environment (RTE) by providing a robust, object-oriented interface for content developers.

Key Features:
*   **Modern Syntax**: Written in ES6+ (Classes, Modules).
*   **Module Support**: First-class support for generic bundlers (Vite, Webpack, Rollup) and native `<script type="module">`.
*   **SCORM Polyfill**: Automatically bridges SCORM 1.2 calls to 2004 syntax, allowing you to write one codebase for multiple standards.
*   **Local Persistence**: Built-in Mock LMS with `localStorage` persistence for developing offline or without an LMS.
*   **Data Compression**: Optional integration with `lz-string` to compress `suspend_data`, maximizing storage limits.

---

## Installation

### Method 1: NPM / Bundlers
```bash
npm install @cybercussion/scobot
```
```javascript
import { SCOBot } from '@cybercussion/scobot';
```

### Method 2: Browser (Script Tag)
Use the production-ready UMD bundle.
```html
<script src="dist/scobot.umd.cjs"></script>
<!-- Exposes window.SCOBot as a namespace object: { SCOBot, SCOBotBase, SCOBotUtil, SCOBot_API_1484_11 } -->
<script>
  const { SCOBot } = window.SCOBot;   // unwrap the constructor
</script>
```

## Quick Start
Check out the **`index.html`** file in the root directory for a complete, working boilerplate.

```javascript
// 1. Initialize
const scobot = new SCOBot({
    debug: true,             // Enable console logging
    use_standalone: true,    // Failover to Mock API if no LMS found
    compression: true,       // Compress suspend_data (lz-string)
    exit_type: "suspend"     // Default exit behavior
});

// 2. Connect — initSCO() = initialize() + start():
//    learner info, entry/mode, and suspend-data restore in one call.
if (scobot.initSCO() === 'true') {
    console.log(`Connected. Mode: ${scobot.getMode()}, Entry: ${scobot.getEntry() || 'ab-initio'}`);
}

// 3. Declare totals once — SCOBot manages cmi.progress_measure for you
//    as objectives complete, and gradeIt() gates completion on it.
scobot.setTotals({
    totalInteractions: '3',
    totalObjectives: '3',
    scoreMin: '0',
    scoreMax: '100'
});

// 4. Bookmark + per-page state — no hand-rolled suspend_data blobs.
scobot.setBookmark('page_5');
scobot.setSuspendDataByPageID('page_5', 'Quiz Page', { answered: true, choice: 'b' });
// ...on relaunch: scobot.getBookmark() / scobot.getSuspendDataByPageID('page_5')

// 5. Record a question — the interaction AND its per-question objective.
scobot.setInteraction({
    id: 'q1',
    type: 'choice',              // true-false, choice, matching, fill-in, performance...
    learner_response: ['b'],     // SCOBot handles the SCORM encoding
    result: 'correct',
    weighting: '1',              // note: write key is 'weighting'; getInteraction returns it as 'weight'
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
// ...read back any time: scobot.getInteraction('q1') / scobot.getObjective('q1')

// 6. Grade & exit — gradeIt() derives score.scaled + success_status and
//    gates completion_status; finish() ends the attempt (or suspend() to
//    save-and-resume). Both commit and terminate for you.
scobot.setvalue('cmi.score.raw', '90');  // gradeIt's input (min/max via setTotals)
scobot.gradeIt();
scobot.finish();
```

> **Raw CMI access** — `scobot.setvalue('cmi.location', 'slide_5')` / `getvalue(...)`
> remain available for anything the Content API doesn't wrap, with automatic
> SCORM 1.2 ↔ 2004 syntax bridging.

## Developer Guide
For detailed instructions, architecture info, and advanced configuration, see the [Developer Usage Guide](usage_guide.md).

---

## Project Structure
*   **`src/`**: Source code (ES Modules).
*   **`dist/`**: Compiled production bundles (ESM and UMD).
*   **`tests/`**: Unit tests via Vitest.
*   **`schemas/`**: Original SCORM XML schemas (XSD/DTD).

## Development
To contribute or modify the library:

1.  **Clone & Install**
    ```bash
    git clone https://github.com/cybercussion/SCOBot.git
    cd SCOBot
    npm install
    ```

2.  **Run Dev Server**
    ```bash
    npm run dev
    ```

3.  **Run Tests**
    ```bash
    npm test
    ```

4.  **Build**
    ```bash
    npm run build
    ```

## Showcase

### SCOBot Player 2

<a href="https://github.com/cybercussion/axiom/tree/scobot-player2">
  <img src="https://github.com/cybercussion/axiom/raw/scobot-player2/docs/scobot-player2.png" alt="SCOBot Player 2" width="600">
</a>

**[Axiom - SCOBot Player 2](https://github.com/cybercussion/axiom/tree/scobot-player2)** is a modern e-learning player built with SCOBot. It demonstrates a complete SCORM integration including:

- 📚 Multiple question types (choice, matching, fill-in-the-blank)
- 🔄 Session persistence and resume capability
- 📊 Score tracking and completion status
- 🎯 Interactive drag-and-drop templates
- 🧪 Standalone mode for LMS-free development
- 📦 Minify/bundle to SCORM-compliant ZIP for LMS deployment

Check out the [SCOBot Integration Guide](https://github.com/cybercussion/axiom/blob/scobot-player2/SCOBot_README.md) for implementation details.

---

## Resources

- 🌐 **[cybercussion.com/scobot](https://cybercussion.com/scobot)** – SCOBot articles, projects, and e-learning resources
- 🧪 **[scobot.cybercussion.com](https://scobot.cybercussion.com)** – Test your content against real SCORM Runtime APIs

---

## License
**CC-BY-SA-4.0**
Copyright (c) 2009-2026 Cybercussion Interactive, LLC.

This library is free to use for personal and commercial projects under the Creative Commons Attribution-ShareAlike 4.0 International License.
