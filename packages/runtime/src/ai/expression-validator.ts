/**
 * Expression validator — ensures JS expressions are safe for sandboxed evaluation.
 *
 * Shared between the workflow engine and the agent planner.
 * Allows: variable access, dot notation, method calls (.map, .filter, etc.),
 * ternary, template literals, arrow callbacks.
 * Blocks: dangerous globals, assignments, semicolons, statement chaining.
 */

export function validateExpression(expr: string): void {
  const dangerous = [
    /\bprocess\b/,
    /\brequire\b/,
    /\bimport\b/,
    /\beval\b/,
    /\bFunction\b/,
    /\bglobal(This)?\b/,
    /\bwindow\b/,
    /\bconstructor\b/,
    /\b__proto__\b/,
    /\bprototype\b/,
    /\bsetTimeout\b/,
    /\bsetInterval\b/,
    /\bfetch\b/,
    /\bXMLHttpRequest\b/,
    /\bchild_process\b/,
    /\bexec\b/,
    /\bspawn\b/,
    /\bfs\b/,
  ];

  for (const pattern of dangerous) {
    if (pattern.test(expr)) {
      throw new Error(`Expression contains disallowed keyword: ${expr.match(pattern)?.[0]}`);
    }
  }

  // Block assignment operators (=, but not ==, !=, <=, >=, ===, !==, =>)
  if (/(?<![!=<>])=(?![=>])/.test(expr)) {
    throw new Error("Expression contains assignment operator, which is not allowed");
  }

  // Block semicolons (prevent statement chaining)
  if (expr.includes(";")) {
    throw new Error("Expression contains semicolons, which are not allowed");
  }
}
