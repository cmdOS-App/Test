**Browse 1.2x Faster with cmdOS**

cmdOS is an open-source command terminal for your browser. Use commands and hotkeys to find anything, launch workflows, reduce context switching, and complete everyday browser tasks faster.

**Use Cases**

**Universal Search:** Press <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">Alt + S</code> to find bookmarks, notes, files, apps, browser history, AI agents, and web tools.

**Command Shortcuts:** Type commands like <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">/notes</code>, <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">/links</code>, <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">/shortcuts</code>, or <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">/screenshot</code> to access actions instantly.

**Text Snippets:** Type <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">c/</code> inside any supported input field to search and insert saved replies, prompts, and templates.

**Website Search:** Use commands like <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">g browser automation</code>, <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">yt startup interviews</code>, or <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">rd productivity tools</code>.

**Keyboard Hotkeys:** Assign <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">Alt + 1</code>, <code style="color: #2e8b57; font-family: monospace; background-color: rgba(46, 139, 87, 0.1); padding: 2px 4px; border-radius: 4px;">Alt + 2</code>, and other shortcuts to open complete tab groups, dashboards, or project setups.

**Workflow Automation:** Build reusable routines for meeting preparation, client research, reporting, onboarding, and daily work.

Built for people who want to browse faster, click less, and turn everyday browser work into commands.

---

### **Getting Started**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/taskbot-dev/NotesExtension.git
   cd NotesExtension
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   pnpm run build
   ```

4. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** in the top right corner.
   - Click **Load unpacked** and select the `dist` folder generated in your project.

### **Tech Stack**

**Core Web**
- **Framework:** React 19
- **Language:** TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS

**Chrome Extension (Manifest V3)**
- **APIs Used:** `chrome.storage`, `chrome.runtime`, `chrome.tabs`, `chrome.scripting`, `chrome.alarms`, `chrome.notifications`, `chrome.bookmarks`, `chrome.cookies`
- **Background:** Service Worker
- **Injection:** Content Scripts (UI overlays & DOM injection)

**Backend & Integrations**
- **Database & Backend:** Supabase
- **Authentication:** Clerk / Supabase Auth
- **Payments & Subscriptions:** Stripe
- **Integrations:** Google Drive Backup, GitHub API

**State Management & Data**
- **Global State:** Redux Toolkit & Zustand
- **Persistence:** Redux Persist & Chrome Storage Local

**Key Libraries**
- **Search:** Fuse.js (Fuzzy search matching)
- **Drag & Drop:** `@dnd-kit`
- **Large Lists:** `@tanstack/react-virtual` & `@tanstack/react-table`
- **Animations:** Framer Motion
- **Analytics / Charts:** Recharts
