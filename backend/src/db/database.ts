import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export class Database {
  readonly #connection: DatabaseSync;

  constructor(path: string) {
    this.#connection = new DatabaseSync(path);
    this.#connection.exec('PRAGMA foreign_keys = ON');
  }

  exec(sql: string): void {
    this.#connection.exec(sql);
  }

  run(sql: string, parameters: SQLInputValue[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const result = this.#connection.prepare(sql).run(...parameters);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  get<Row extends object>(sql: string, parameters: SQLInputValue[] = []): Row | undefined {
    return this.#connection.prepare(sql).get(...parameters) as Row | undefined;
  }

  all<Row extends object>(sql: string, parameters: SQLInputValue[] = []): Row[] {
    return this.#connection.prepare(sql).all(...parameters) as Row[];
  }

  transaction<Result>(operation: () => Result): Result {
    this.#connection.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.#connection.exec('COMMIT');
      return result;
    } catch (error) {
      this.#connection.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.#connection.close();
  }
}
