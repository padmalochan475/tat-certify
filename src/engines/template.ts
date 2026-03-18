export function applyTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/{{(.*?)}}/g, (_, key: string) => {
    const value = data[key.trim()];
    return value === undefined || value === null ? "" : String(value);
  });
}
