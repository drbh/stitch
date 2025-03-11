import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import fs from "fs";

export class FileStoreWrapperClient {
  private localPath;

  constructor(dirName: string) {
      let localPath = `${dirName}`
      // make sure local_bucket exists
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath);
      }
      this.localPath = localPath
  }

  async put (key: string, value: string) {

    const fullPath = `${this.localPath}/${key}`
    // make sure all directories exist
    const dirs = fullPath.split("/");
    dirs.pop();
    let dir = "";
    for (const d of dirs) {
      dir += d + "/";
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
    }
    await fs.writeFileSync(fullPath, value);
  }

  async get (key: string) {
    return fs.readFileSync(`${this.localPath}/${key}`);
  }

  static async initialize(path: string) {
    return new FileStoreWrapperClient(path)
  }
}

export class Statement {
  private query: string;
  private db: Database;

  // Private constructor; use the static initialize() method to create an instance.
  constructor(query: string, db: Database) {
    this.query = query;
    this.db = db;
  }

  async run() {
    let results = await this.db.exec(this.query);
    return { results, success: true, meta: { last_row_id: 1 } };
  }

  async first() {
    const modifiedQuery = this.query.replace(";", "") + " LIMIT 1;";
    let results = await this.db.exec(modifiedQuery);
    return { results, success: true };
  }

  async all() {
    const results = await this.db.all(this.query);
    return { results, success: true };
  }

  bind(...params: any) {
    let modifiedQuery = String(this.query);
    for (const pram of params) {
      if (typeof pram === "number") {
        modifiedQuery = modifiedQuery.replace("?", `${pram}`);
      } else if (typeof pram === "object") {
        // TODO: dont treat all objects as null
        modifiedQuery = modifiedQuery.replace("?", `null`);
      } else {
        modifiedQuery = modifiedQuery.replace("?", `"${pram}"`);
      }
    }

    this.query = modifiedQuery;
    return this;
  }
}

/**
 * SqliteThreadClient implements ThreadClient using a local SQLite database.
 */
export class SqliteThreadWrapperClient {
  private db: Database;

  // Private constructor; use the static initialize() method to create an instance.
  private constructor(db: Database) {
    // super();
    this.db = db;
  }

  /**
   * Initialize a new instance.
   * Ensures that the necessary tables exist.
   */
  static async initialize(dbPath: string): Promise<SqliteThreadWrapperClient> {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    return new SqliteThreadWrapperClient(db);
  }

  //   prepare(query: string): D1PreparedStatement;
  prepare(query: string): Statement {
    return new Statement(query, this.db);
  }
}
