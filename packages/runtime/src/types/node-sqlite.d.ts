// Type declarations for node:sqlite (Node.js 22.5+)
declare module "node:sqlite" {
  type SQLInputValue = string | number | bigint | null | Uint8Array;

  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    run(...params: SQLInputValue[]): RunResult;
    get(...params: SQLInputValue[]): Record<string, unknown> | undefined;
    all(...params: SQLInputValue[]): Array<Record<string, unknown>>;
  }

  interface RunResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }
}
