/**
 * Template Service
 * Handles CRUD operations for JSON-driven templates
 */

import type {
  TemplateV2Input,
  TemplateRecord,
  TemplateVersionRecord,
  TemplateJson
} from "../schema";
import { templateJsonSchema, templateV2InputSchema } from "../schema";

export class TemplateService {
  constructor(private db: D1Database) {}

  /**
   * Create a new template
   */
  async createTemplate(
    input: TemplateV2Input,
    createdBy: string
  ): Promise<TemplateRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Prepare internal template JSON
    const templateJson = JSON.parse(input.template_json);
    templateJson.id = id;
    templateJson.version = 1;
    templateJson.active = input.active ?? true;
    templateJson.created_at = now;
    templateJson.updated_at = now;
    templateJson.created_by = createdBy;
    
    // Validate complete template JSON
    templateJsonSchema.parse(templateJson);
    
    const template: TemplateRecord = {
      id,
      name: input.name,
      type: input.type,
      version: 1,
      template_json: JSON.stringify(templateJson),
      active: input.active ?? true,
      created_at: now,
      updated_at: now,
      created_by: createdBy
    };

    await this.db
      .prepare(
        `INSERT INTO templates_v2 (id, name, type, version, template_json, active, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        template.id,
        template.name,
        template.type,
        template.version,
        template.template_json,
        template.active ? 1 : 0,
        template.created_at,
        template.updated_at,
        template.created_by
      )
      .run();

    // Create initial version
    await this.createTemplateVersion(id, 1, template.template_json, "Initial version", createdBy);

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<TemplateRecord | null> {
    const result = await this.db
      .prepare(`SELECT * FROM templates_v2 WHERE id = ?`)
      .bind(id)
      .first<any>();

    if (!result) return null;

    return {
      ...result,
      active: Boolean(result.active)
    };
  }

  /**
   * List all templates
   */
  async listTemplates(filters?: {
    type?: string;
    active?: boolean;
  }): Promise<TemplateRecord[]> {
    let query = `SELECT * FROM templates_v2 WHERE 1=1`;
    const bindings: any[] = [];

    if (filters?.type) {
      query += ` AND type = ?`;
      bindings.push(filters.type);
    }

    if (filters?.active !== undefined) {
      query += ` AND active = ?`;
      bindings.push(filters.active ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.prepare(query).bind(...bindings).all<any>();

    return result.results.map(row => ({
      ...row,
      active: Boolean(row.active)
    }));
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: string,
    updates: Partial<TemplateV2Input>,
    updatedBy: string
  ): Promise<TemplateRecord> {
    const existing = await this.getTemplate(id);
    if (!existing) {
      throw new Error("Template not found");
    }

    const now = new Date().toISOString();
    let newVersion = existing.version;
    let templateJson = existing.template_json;

    // If template_json is being updated, increment version
    if (updates.template_json) {
      newVersion = existing.version + 1;
      const parsedJson = JSON.parse(updates.template_json);
      templateJsonSchema.parse(parsedJson);
      
      parsedJson.id = id;
      parsedJson.version = newVersion;
      parsedJson.updated_at = now;
      
      templateJson = JSON.stringify(parsedJson);
      
      // Create new version record
      await this.createTemplateVersion(
        id,
        newVersion,
        templateJson,
        "Template updated",
        updatedBy
      );
    }

    const updated: TemplateRecord = {
      ...existing,
      name: updates.name ?? existing.name,
      type: updates.type ?? existing.type,
      version: newVersion,
      template_json: templateJson,
      active: updates.active ?? existing.active,
      updated_at: now
    };

    await this.db
      .prepare(
        `UPDATE templates_v2 
         SET name = ?, type = ?, version = ?, template_json = ?, active = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        updated.name,
        updated.type,
        updated.version,
        updated.template_json,
        updated.active ? 1 : 0,
        updated.updated_at,
        id
      )
      .run();

    return updated;
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    // Check if template is used in any applications
    const usageCheck = await this.db
      .prepare(`SELECT COUNT(*) as count FROM applications WHERE template_id = ?`)
      .bind(id)
      .first<{ count: number }>();

    if (usageCheck && typeof usageCheck === 'object' && usageCheck.count > 0) {
      throw new Error("Cannot delete template that is used in applications");
    }

    // Delete template versions first
    await this.db
      .prepare(`DELETE FROM template_versions WHERE template_id = ?`)
      .bind(id)
      .run();

    // Delete template
    await this.db
      .prepare(`DELETE FROM templates_v2 WHERE id = ?`)
      .bind(id)
      .run();
  }

  /**
   * Clone template
   */
  async cloneTemplate(
    id: string,
    newName: string,
    clonedBy: string
  ): Promise<TemplateRecord> {
    const original = await this.getTemplate(id);
    if (!original) {
      throw new Error("Template not found");
    }

    const templateJson = JSON.parse(original.template_json);
    templateJson.name = newName;

    return this.createTemplate(
      {
        name: newName,
        type: original.type,
        template_json: JSON.stringify(templateJson),
        active: true
      },
      clonedBy
    );
  }

  /**
   * Get template versions
   */
  async getTemplateVersions(templateId: string): Promise<TemplateVersionRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM template_versions 
         WHERE template_id = ? 
         ORDER BY version DESC`
      )
      .bind(templateId)
      .all<TemplateVersionRecord>();

    return result.results;
  }

  /**
   * Create template version record
   */
  private async createTemplateVersion(
    templateId: string,
    version: number,
    templateJson: string,
    changes: string,
    createdBy: string
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO template_versions (id, template_id, version, template_json, changes, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, templateId, version, templateJson, changes, now, createdBy)
      .run();
  }

  /**
   * Get template by type (for student portal)
   */
  async getTemplatesByType(type: string): Promise<TemplateRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM templates_v2 
         WHERE type = ? AND active = 1 
         ORDER BY name ASC`
      )
      .bind(type)
      .all<any>();

    return result.results.map(row => ({
      ...row,
      active: Boolean(row.active)
    }));
  }

  /**
   * Parse template JSON safely
   */
  parseTemplateJson(template: TemplateRecord): TemplateJson {
    const parsed = JSON.parse(template.template_json);
    return templateJsonSchema.parse(parsed);
  }

  /**
   * Validate template JSON structure
   */
  validateTemplateJson(jsonString: string): { valid: boolean; errors?: any } {
    try {
      const parsed = JSON.parse(jsonString);
      templateJsonSchema.parse(parsed);
      return { valid: true };
    } catch (error) {
      return { valid: false, errors: error };
    }
  }
}
