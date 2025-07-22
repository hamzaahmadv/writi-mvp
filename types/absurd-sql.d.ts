declare module "absurd-sql" {
  export class SQLiteFS {
    constructor(FS: any, backend: any): SQLiteFS
  }
}

declare module "absurd-sql/dist/indexeddb-backend" {
  export default class IndexedDBBackend {
    constructor(): IndexedDBBackend
  }
}

declare module "sql.js" {
  export interface Database {
    exec(sql: string): any[]
    prepare(sql: string): Statement
    close(): void
    export(): Uint8Array
  }

  export interface Statement {
    step(): boolean
    getAsObject(): any
    bind(params: any[]): void
    run(params?: any[]): void
    free(): void
  }

  export interface SQL {
    Database: new (data?: ArrayLike<number> | string) => Database
    FS: any
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SQL>
}

declare module "@jlongster/sql.js" {
  export interface Database {
    exec(sql: string): any[]
    prepare(sql: string): Statement
    close(): void
    export(): Uint8Array
  }

  export interface Statement {
    step(): boolean
    getAsObject(): any
    bind(params: any[]): void
    run(params?: any[]): void
    free(): void
  }

  export interface SQL {
    Database: new (data?: ArrayLike<number> | string) => Database
    FS: any
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SQL>
}
