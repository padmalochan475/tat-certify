/**
 * Branch Contact Service
 * Handles CRUD operations for branch contacts
 */

export interface BranchContact {
  id: string;
  branch_id: string;
  contact_name: string;
  designation: string;
  mobile_number: string;
  email: string | null;
  office_location: string | null;
  available_timing: string | null;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface BranchContactInput {
  branch_id: string;
  contact_name: string;
  designation: string;
  mobile_number: string;
  email?: string;
  office_location?: string;
  available_timing?: string;
  active?: boolean;
  priority?: number;
}

export class BranchContactService {
  constructor(private db: D1Database) {}

  /**
   * Create a new branch contact
   */
  async create(input: BranchContactInput): Promise<BranchContact> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO branch_contacts (
        id, branch_id, contact_name, designation, mobile_number,
        email, office_location, available_timing, active, priority,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      input.branch_id,
      input.contact_name,
      input.designation,
      input.mobile_number,
      input.email || null,
      input.office_location || null,
      input.available_timing || null,
      input.active !== false ? 1 : 0,
      input.priority || 1,
      now,
      now
    ).run();

    return this.getById(id) as Promise<BranchContact>;
  }

  /**
   * Get all branch contacts
   */
  async getAll(branchId?: string): Promise<BranchContact[]> {
    let query = 'SELECT * FROM branch_contacts';
    const params: any[] = [];

    if (branchId) {
      query += ' WHERE branch_id = ?';
      params.push(branchId);
    }

    query += ' ORDER BY priority ASC, created_at DESC';

    const result = await this.db.prepare(query).bind(...params).all<BranchContact>();
    return result.results.map(this.mapContact);
  }

  /**
   * Get branch contact by ID
   */
  async getById(id: string): Promise<BranchContact | null> {
    const contact = await this.db.prepare(
      'SELECT * FROM branch_contacts WHERE id = ?'
    ).bind(id).first<any>();

    return contact ? this.mapContact(contact) : null;
  }

  /**
   * Get active contacts for a branch
   */
  async getActiveByBranch(branchId: string): Promise<BranchContact[]> {
    const result = await this.db.prepare(
      'SELECT * FROM branch_contacts WHERE branch_id = ? AND active = 1 ORDER BY priority ASC'
    ).bind(branchId).all<any>();

    return result.results.map(this.mapContact);
  }

  /**
   * Update branch contact
   */
  async update(id: string, input: Partial<BranchContactInput>): Promise<BranchContact> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Branch contact not found');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (input.contact_name !== undefined) {
      updates.push('contact_name = ?');
      params.push(input.contact_name);
    }
    if (input.designation !== undefined) {
      updates.push('designation = ?');
      params.push(input.designation);
    }
    if (input.mobile_number !== undefined) {
      updates.push('mobile_number = ?');
      params.push(input.mobile_number);
    }
    if (input.email !== undefined) {
      updates.push('email = ?');
      params.push(input.email || null);
    }
    if (input.office_location !== undefined) {
      updates.push('office_location = ?');
      params.push(input.office_location || null);
    }
    if (input.available_timing !== undefined) {
      updates.push('available_timing = ?');
      params.push(input.available_timing || null);
    }
    if (input.active !== undefined) {
      updates.push('active = ?');
      params.push(input.active ? 1 : 0);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    await this.db.prepare(
      `UPDATE branch_contacts SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    return this.getById(id) as Promise<BranchContact>;
  }

  /**
   * Delete branch contact
   */
  async delete(id: string): Promise<void> {
    await this.db.prepare(
      'DELETE FROM branch_contacts WHERE id = ?'
    ).bind(id).run();
  }

  /**
   * Map database row to BranchContact
   */
  private mapContact(row: any): BranchContact {
    return {
      id: row.id,
      branch_id: row.branch_id,
      contact_name: row.contact_name,
      designation: row.designation,
      mobile_number: row.mobile_number,
      email: row.email,
      office_location: row.office_location,
      available_timing: row.available_timing,
      active: Boolean(row.active),
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
