# Step Versioning (Automation Actions)

This project supports versioned action names (e.g. `open_url_v1`, `open_url_v2`) while keeping old actions (e.g. `open_url`) working.

## Key Rules
- Versioning is internal only. It should not be shown to end users unless you explicitly choose to.
- Old actions without a suffix (e.g. `open_url`) are treated as **v1**.
- The base action list remains unversioned (e.g. `open_url`, `click`), and versioned actions are handled via a suffix.

## How To Add A New Step (Minimal Checklist)

1. **Add the base action name**  
   File: `chrome-extension/src/background/automationExecutor.ts`  
   Add your action to `ModuleActionBase`:
   ```ts
   type ModuleActionBase =
     | 'open_url'
     | 'click'
     | 'your_new_action'
     | ...;
   ```

2. **Implement the executor behavior**  
   File: `chrome-extension/src/background/automationExecutor.ts`  
   Handle it in `executeAction` using the base action:
   ```ts
   case 'your_new_action': {
     // your logic here
     break;
   }
   ```

   If you need version-specific behavior later:
   ```ts
   const actionVersion = getActionVersion(action.action);
   if (baseAction === 'your_new_action' && actionVersion === 2) {
     // v2 logic
   }
   ```

3. **Use the versioned action in module definitions**  
   Example:
   ```json
   { "action": "your_new_action_v1", "selector": "#my-el" }
   ```
   Existing modules/automations using `"your_new_action"` still work and are treated as v1.

4. **(Optional) Add UI support**  
   If the step needs to be editable/visible in the Agent UI:
   - `pages/new-tab/src/components/Editor/AgentPanel.tsx`
   - `pages/new-tab/src/components/Editor/AgentStepTable.tsx`

## Why This Works
The executor strips the `_vN` suffix to get the base action, so:
- `open_url` → `open_url` (defaults to v1)
- `open_url_v1` → `open_url` (explicit v1)
- `open_url_v2` → `open_url` (version-aware behavior can be added later)
