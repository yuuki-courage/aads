export type Primitive = string | number | boolean | null | Date;

export interface SchemaFieldDefinition {
  source?: string;
  sources?: string[];
  literal?: Primitive;
  default?: Primitive;
  transform?: string;
  required?: boolean;
  description?: string;
}

export interface SchemaSkipCondition {
  type: "empty" | "emptyOrZero" | "equals";
  source?: string;
  sources?: string[];
  value?: Primitive;
  values?: Primitive[];
  reason?: string;
}

export interface SchemaEntityDefinition {
  requiredColumns?: string[];
  fields: Record<string, SchemaFieldDefinition>;
  skipConditions?: SchemaSkipCondition[];
}

export interface BulkSchema {
  id: string;
  version: string;
  description: string;
  header: string[];
  defaults?: Record<string, SchemaFieldDefinition>;
  entities: Record<string, SchemaEntityDefinition>;
}
