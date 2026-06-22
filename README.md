
cmdos is a keyboard-first command terminal for the web.

Access your links, notes, snippets, apps, automations, agents, files, browser history, and daily workflows from one command bar.

## Why cmdOS

cmdOS turns repeated browser actions into commands.

- Search websites instantly
- Open links, apps, files, and tab groups
- Find notes and saved resources
- Insert reusable snippets and templates
- Run browser utilities
- Launch routines and automations
- Create tasks and calendar events
- Assign shortcuts to frequently used actions



## Features

### Command palette

Open cmdOS with `Alt + S` and run commands from one place.

Examples:
/notes
/link
/shortcuts
/screenshot


### Web search commands

Create short commands for the websites you use every day.


g browser automation (Google serach)
yt startup interviews (Youtube search)
Rd productivity tools



### Notes and snippets

Create rich notes and reusable text snippets.

Type `c/` inside supported website input fields to search and insert saved snippets without leaving the page.

### Links and tab groups

Save individual links or groups of browser tabs and open them together.

Dynamic links can use `{query}`:

```txt
https://google.com/search?q={query}
```

### Routines

Combine links, notes, tabs, and commands into reusable workflows.

Examples:

- Morning startup
- Stand-up preparation
- Client research
- Meeting preparation
- Weekly reporting

### Browser utilities

cmdOS includes utilities for common browser tasks:

- Visible-page screenshots
- Full-page screenshots
- Image downloads
- Table extraction
- CSV export
- Print-friendly PDFs

### Keyboard shortcuts

Save multiple links as one group and open them together with a single shortcut.

Examples:

Alt + 1 — Open Gmail, Slack, Calendar, and your task manager
Alt + 2 — Open all client project links
Alt + 3 — Open your daily analytics dashboards
Alt + 4 — Open research tools and saved resources
Alt + 5 — Open all links needed for a meeting
Alt + 6 — Open development tools, GitHub, Linear, and documentation
Alt + 7 — Open your social media publishing tools
Alt + 8 — Open finance, reporting, and payment dashboards

Useful bulk link groups:

Morning workspace
Client onboarding
Stand-up preparation
Weekly reporting
Product research
Content publishing
Sales follow-up
Customer support
Development setup
Meeting preparation

One shortcut can open every link you need for a workflow at once.
### Workspaces

Organize resources using workspaces, folders, and subfolders.

Folders can include custom icons, emojis, SVGs, and accent colors.


## Open-source and private features

The repository separates open-source and proprietary features using the `@private-features` alias.

This keeps the public build separate from hosted collaboration, sharing, billing, and other commercial features.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- pnpm workspaces
- Turborepo
- Chrome Extension APIs

## Workspace structure

This project is configured as a monorepo using **pnpm workspaces** and **Turborepo**.

- **[packages/](packages/)**: Shared internal packages
  - `ui/`: Design system components
  - `shared/`: Utility helper functions and schemas
  - `storage/`: Chrome storage helpers
  - `env/`: Environment variable schemas
  - `module-manager/`: Core module configuration
- **[pages/](pages/)**: Chrome Extension entry points
  - `new-tab/`: Primary new tab workspace dashboard
  - `popup/`: Browser toolbar popup
  - `side-panel/`: Native sidebar integrations
  - `options/`: Configuration and settings pages
  - `devtools/` and `devtools-panel/`: Developer tools panel
  - `content/` and `content-ui/`: Injected page content scripts
- **[docs/](docs/)**: Documentation and project guides

## Getting started

### Prerequisites

- **Node.js**: `v22.12.0` or higher
- **pnpm**: `v9.15.1` or higher
- Google Chrome or another Chromium-based browser

### Installation

Install workspace dependencies:

```bash
pnpm install
```

### Development

Run the development environment:

```bash
pnpm dev
```

The development server watches for changes and rebuilds the extension automatically.

Open:

```txt
chrome://extensions/
```

Enable **Developer mode**, select **Load unpacked**, and choose the generated `dist/` directory.

### Building

Build the production-ready Chrome Extension:

```bash
pnpm build
```

Build in public open-source mode without private sharing and collaboration interfaces:

```powershell
$env:VITE_ENABLE_SHARING="false"
pnpm run build
```



## Contributing

Contributions, bug reports, feature requests, and documentation improvements are welcome.

Before submitting a pull request:

1. Create a new branch.
2. Keep the change focused.
3. Test the extension locally.
4. Explain the purpose of the change clearly.

## Security

Do not report security vulnerabilities through public GitHub issues.

Report security concerns privately to the maintainers.

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for the full text.



Copyright 2024-2026 RPA TASKLABS AUTOMATION SOFTWARE PRIVATE LIMITED

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.


