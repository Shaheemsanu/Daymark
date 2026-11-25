import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('supabase/schema.sql', 'utf8');
const migrations = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort();
const functionPattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([\w]+)\s*\([\s\S]*?\)\s*RETURNS\s+[\s\S]*?\$\$[\s\S]*?\$\$\s*;/gi;
const normalizeFunction = (sql: string) => sql.replace(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i, 'CREATE FUNCTION').replace(/\s+/g, ' ').trim().toLowerCase();

describe('main schema and migrations', () => {
  it('contains migration tables, indexes, and added column names', () => {
    for (const file of migrations) {
      const sql = readFileSync(join('supabase/migrations', file), 'utf8');
      const objects = /CREATE\s+(?:TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?|(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?)(?:public\.)?([\w]+)/gi;
      const columns = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w]+)/gi;
      const namedConstraints = /ADD\s+CONSTRAINT\s+([\w]+)/gi;
      for (const match of [...sql.matchAll(objects), ...sql.matchAll(columns), ...sql.matchAll(namedConstraints)]) {
        expect(schema, `${file}: ${match[1]}`).toMatch(new RegExp(`\\b${match[1]}\\b`, 'i'));
      }
      const policiesAndTriggers = /CREATE\s+(?:POLICY|TRIGGER)\s+("[^"]+"|[\w]+)/gi;
      for (const match of sql.matchAll(policiesAndTriggers)) expect(schema.toLowerCase(), `${file}: ${match[1]}`).toContain(match[1].toLowerCase());
    }
  });

  it('contains the latest migration definition of each public function', () => {
    const latest = new Map<string, { file: string; definition: string }>();
    for (const file of migrations) {
      const sql = readFileSync(join('supabase/migrations', file), 'utf8');
      for (const match of sql.matchAll(functionPattern)) latest.set(match[1].toLowerCase(), { file, definition: normalizeFunction(match[0]) });
    }
    const schemaFunctions = new Map<string, string>();
    for (const match of schema.matchAll(functionPattern)) schemaFunctions.set(match[1].toLowerCase(), normalizeFunction(match[0]));
    for (const [name, expected] of latest) expect(schemaFunctions.get(name), `${expected.file}: ${name}`).toBe(expected.definition);
  });
});
