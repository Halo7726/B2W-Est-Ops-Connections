export const migrationSql: string[] = [
  `
  CREATE TABLE IF NOT EXISTS ops_cache (
    entity TEXT NOT NULL,
    object_id TEXT NOT NULL,
    job_number TEXT,
    data_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(entity, object_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS cache_meta (
    entity TEXT NOT NULL,
    job_number TEXT NOT NULL DEFAULT '',
    rows_synced INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(entity, job_number)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS report_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    entity TEXT NOT NULL,
    filters_json TEXT NOT NULL DEFAULT '[]',
    sorts_json TEXT NOT NULL DEFAULT '[]',
    columns_json TEXT NOT NULL DEFAULT '[]',
    groupings_json TEXT NOT NULL DEFAULT '[]',
    is_shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS report_runs (
    id TEXT PRIMARY KEY,
    report_definition_id TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_definition_id) REFERENCES report_definitions(id)
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_ops_cache_entity_job
    ON ops_cache(entity, job_number);
  `,
];
