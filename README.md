# SCOBot - Modern SCORM Library
[![CI](https://github.com/cybercussion/SCOBot/actions/workflows/ci.yml/badge.svg?branch=v5)](https://github.com/cybercussion/SCOBot/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-5.2.0-blue)]()
[![License](https://img.shields.io/badge/license-CC--BY--SA--4.0-orange)]()

![logo](https://content.cybercussion.com/css/img/cybercussion_logo_black_sm.png)

**Links:** [SCOBot Platform](https://scobot.cybercussion.com) · [SCOBot at Cybercussion](https://cybercussion.com/scobot) · [Documentation Wiki](https://github.com/cybercussion/SCOBot/wiki)

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
<!-- Exposes global: SCOBot -->
```

## Quick Start
Check out the **`index.html`** file in the root directory for a complete, working boilerplate.

```javascript
// 1. Initialize
const scobot = new SCOBot({
    debug: true,             // Enable console logging
    use_standalone: true,    // Failover to Mock API if no LMS found
    compression: true,       // Compress data to save space
    exit_type: "suspend"     // Default exit behavior
});

// 2. Connect
if (scobot.initialize() === 'true') {
    console.log("Connected to LMS (or Mock)!");
}

// 3. Set Data (Uses SCORM 2004 syntax)
scobot.setvalue('cmi.score.scaled', '0.9');
scobot.setvalue('cmi.location', 'slide_5');
scobot.setvalue('cmi.suspend_data', JSON.stringify({ bookmarks: [1, 5, 8] }));

// 4. Save & Exit
scobot.commit();
scobot.terminate();
```

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

- 🌐 **[cybercussion.com](https://cybercussion.com)** – More projects, articles, and e-learning resources
- 🧪 **[angular.scobot.net](https://angular.scobot.net)** – Test your content against real SCORM Runtime APIs

---

## License
**CC-BY-SA-4.0**
Copyright (c) 2009-2026 Cybercussion Interactive, LLC.

This library is free to use for personal and commercial projects under the Creative Commons Attribution-ShareAlike 4.0 International License.
