/**
 * Workflow execution context — variable store for passing data between steps.
 *
 * Each workflow run gets its own context. Steps write outputs via `outputVar`,
 * and subsequent steps can reference those variables in their arguments using
 * template syntax: {{varName}} or {{varName.nested.path}}
 */

export class WorkflowContext {
  private vars = new Map<string, unknown>();
  private stepResults: Array<{ stepId: string; result: unknown; error?: string }> = [];

  /** Set a variable. */
  set(key: string, value: unknown): void {
    this.vars.set(key, value);
  }

  /** Get a variable by key. Supports dot-notation for nested access. */
  get(key: string): unknown {
    // Simple key — direct lookup
    if (!key.includes(".")) {
      return this.vars.get(key);
    }

    // Dot-notation — traverse
    const parts = key.split(".");
    let current: unknown = this.vars.get(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[parts[i]];
    }
    return current;
  }

  /** Check if a variable exists. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Get all variables as a plain object. */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.vars) {
      result[key] = value;
    }
    return result;
  }

  /** Record a step result for run history. */
  recordStep(stepId: string, result: unknown, error?: string): void {
    this.stepResults.push({ stepId, result, error });
  }

  /** Get all step results. */
  getStepResults(): Array<{ stepId: string; result: unknown; error?: string }> {
    return [...this.stepResults];
  }

  /**
   * Resolve template strings in a value.
   * Replaces {{varName}} with the variable's value.
   * Works recursively on objects and arrays.
   */
  resolve<T>(value: T): T {
    if (typeof value === "string") {
      return this.resolveString(value) as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.resolve(item)) as T;
    }
    if (value !== null && typeof value === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolve(v);
      }
      return resolved as T;
    }
    return value;
  }

  private resolveString(str: string): unknown {
    // If the entire string is a single variable reference, return the raw value (preserves type)
    const fullMatch = str.match(/^\{\{([^}]+)\}\}$/);
    if (fullMatch) {
      return this.get(fullMatch[1].trim()) ?? str;
    }

    // Otherwise, interpolate within the string (coerces to string)
    return str.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
      const val = this.get(varName.trim());
      if (val === undefined) return `{{${varName}}}`;
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    });
  }
}
