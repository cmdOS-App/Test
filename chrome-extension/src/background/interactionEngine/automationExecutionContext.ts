/**
 * interactionEngine/automationExecutionContext.ts
 *
 * Single source of truth for the global automation execution state.
 * Prevents extension hotkeys and snippets from triggering themselves.
 */

class AutomationExecutionContext {
  private active = false;

  /**
   * Start the execution context. 
   * Interactions should be wrapped with this to prevent self-triggering.
   */
  start() {
    this.active = true;
    
  }

  /**
   * Stop the execution context.
   */
  stop() {
    this.active = false;
    
  }

  /**
   * Returns true if an automation interaction is currently in progress.
   */
  isActive() {
    return this.active;
  }
}

export const automationExecutionContext = new AutomationExecutionContext();
