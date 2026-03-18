const tableDefinitions: Record<string, { key: string; columns: string[] }> = {
  students: {
    key: "id",
    columns: [
      "id",
      "full_name",
      "reg_no",
      "branch",
      "year",
      "session",
      "cert_type",
      "company",
      "company_hr_title",
      "company_address",
      "duration",
      "start_date",
      "status",
      "created_at"
    ]
  },
  branches: {
    key: "code",
    columns: [
      "code",
      "name",
      "hod_name",
      "hod_email",
      "hod_mobile",
      "current_serial",
      "serial_year"
    ]
  },
  companies: {
    key: "name",
    columns: ["name", "hr_title", "address"]
  },
  academic_sessions: {
    key: "value",
    columns: ["value", "active"]
  },
  duration_policies: {
    key: "id",
    columns: ["id", "cert_type", "label", "active"]
  },
  templates: {
    key: "id",
    columns: ["id", "name", "type", "content", "active"]
  },
  certificate_log: {
    key: "ref_no",
    columns: ["ref_no", "student_id", "template_id", "generated_on", "academic_year"]
  }
};

type TableName = keyof typeof tableDefinitions;
type RecordShape = Record<string, unknown>;

function serializeValue(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return value;
}

function serializeRecord(record: RecordShape): RecordShape {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, serializeValue(value)])
  );
}

async function runStatement(
  db: D1Database,
  sql: string,
  values: unknown[]
): Promise<D1Result<RecordShape>> {
  const statement = db.prepare(sql);
  const prepared = values.length > 0 ? statement.bind(...values) : statement;
  return prepared.run<RecordShape>();
}

export class CrudEngine {
  constructor(private readonly db: D1Database) {}

  async create(table: TableName, data: RecordShape): Promise<void> {
    const { columns } = tableDefinitions[table];
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      throw new Error(`No data provided for ${table} create`);
    }

    for (const [key] of entries) {
      if (!columns.includes(key)) {
        throw new Error(`Column ${key} is not allowed on ${table}`);
      }
    }

    const serialized = serializeRecord(Object.fromEntries(entries));
    const values = entries.map(([key]) => serialized[key]);
    const columnList = entries.map(([key]) => key).join(", ");
    const placeholders = entries.map(() => "?").join(", ");

    await runStatement(
      this.db,
      `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
      values
    );
  }

  async read(table: TableName, filters: RecordShape = {}): Promise<RecordShape[]> {
    const { columns } = tableDefinitions[table];
    const entries = Object.entries(filters).filter(([, value]) => value !== undefined);

    for (const [key] of entries) {
      if (!columns.includes(key)) {
        throw new Error(`Column ${key} is not allowed on ${table}`);
      }
    }

    const serialized = serializeRecord(Object.fromEntries(entries));
    const values = entries.map(([key]) => serialized[key]);
    const whereClause =
      entries.length === 0
        ? ""
        : ` WHERE ${entries.map(([key]) => `${key} = ?`).join(" AND ")}`;
    const result = await runStatement(this.db, `SELECT * FROM ${table}${whereClause}`, values);
    return result.results;
  }

  async update(table: TableName, id: string, data: RecordShape): Promise<void> {
    const { key, columns } = tableDefinitions[table];
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      throw new Error(`No data provided for ${table} update`);
    }

    for (const [column] of entries) {
      if (column === key) {
        throw new Error(`Primary key ${key} cannot be updated on ${table}`);
      }

      if (!columns.includes(column)) {
        throw new Error(`Column ${column} is not allowed on ${table}`);
      }
    }

    const serialized = serializeRecord(Object.fromEntries(entries));
    const values = entries.map(([column]) => serialized[column]);

    await runStatement(
      this.db,
      `UPDATE ${table} SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE ${key} = ?`,
      [...values, id]
    );
  }

  async delete(table: TableName, id: string): Promise<void> {
    const { key } = tableDefinitions[table];
    await runStatement(this.db, `DELETE FROM ${table} WHERE ${key} = ?`, [id]);
  }
}
