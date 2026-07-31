// Object schema validation. Configuration loaded from .serif-brain/config.yaml.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "./yaml.mjs";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const ID_RE = /^(bug|decision|record|plan|note|session)-[a-z0-9-]+$/;

const REQUIRED_BY_TYPE = {
  bug:      ["id", "type", "project", "module", "title", "status", "priority", "created_at", "updated_at"],
  decision: ["id", "type", "project", "module", "title", "status", "priority", "created_at", "updated_at"],
  // record = bitmis is kaydi (status: done dogar). Alan sozlesmesi decision ile
  // ayni; disk uzerinde decisions/ altinda yasar (bkz. object.mjs TYPE_DIR_ALIAS).
  record:   ["id", "type", "project", "module", "title", "status", "priority", "created_at", "updated_at"],
  // plan = yol haritasi / faz plani. Kendi dizini plans/ altindadir; 'active'
  // dogar ve faz bitince 'done' yapilir. Bug/karar gibi is kalemi degildir:
  // sirayi ve cikis olcutlerini tasir.
  plan:     ["id", "type", "project", "module", "title", "status", "priority", "created_at", "updated_at"],
  note:     ["id", "type", "project", "title", "status", "created_at", "updated_at"],
  session:  ["id", "type", "project", "title", "created_at"]
};

let _config = null;

export function loadConfig(brainRoot) {
  const configPath = join(brainRoot, "config.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`config.yaml missing at ${configPath} — run 'serif-brain init'`);
  }
  _config = parseYaml(readFileSync(configPath, "utf8"));
  return _config;
}

export function getConfig() {
  if (!_config) throw new Error("Config not loaded — call loadConfig(brainRoot) first");
  return _config;
}

export function validateObject(obj, opts = {}) {
  const errors = [];
  const warnings = [];
  const config = opts.config || getConfig();

  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["frontmatter is empty or not an object"], warnings };
  }

  // Type
  const type = obj.type;
  if (!type) errors.push("missing 'type'");
  else if (!REQUIRED_BY_TYPE[type]) errors.push(`unknown type: ${type}`);

  // Required fields
  const required = REQUIRED_BY_TYPE[type] || [];
  for (const field of required) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      errors.push(`missing required field: ${field}`);
    }
  }

  // ID format
  if (obj.id && !ID_RE.test(obj.id)) {
    errors.push(`invalid id format: ${obj.id} (expected ^(bug|decision|note|session)-[a-z0-9-]+$)`);
  }

  // Status enum
  if (obj.status && !config.valid_status.includes(obj.status)) {
    errors.push(`invalid status: ${obj.status} (valid: ${config.valid_status.join(", ")})`);
  }

  // Priority enum
  if (obj.priority && !config.valid_priority.includes(obj.priority)) {
    errors.push(`invalid priority: ${obj.priority} (valid: ${config.valid_priority.join(", ")})`);
  }

  // Severity (bug only) — kendi enum'u (valid_severity); yoksa geriye-uyumlu
  // olarak valid_priority'ye düş. Önceden daima valid_priority kullanılıyordu →
  // ayrı bir severity ölçeği (örn. blocker/major/minor) tanımlanamıyordu.
  if (type === "bug" && obj.severity) {
    const validSeverity = config.valid_severity || config.valid_priority;
    if (!validSeverity.includes(obj.severity)) {
      errors.push(`invalid severity: ${obj.severity} (valid: ${validSeverity.join(", ")})`);
    }
  }

  // Module(s)
  const modules = Array.isArray(obj.module) ? obj.module : (obj.module ? [obj.module] : []);
  for (const m of modules) {
    if (!config.valid_modules.includes(m)) {
      warnings.push(`unknown module: ${m} (consider adding to config.valid_modules or using 'unknown')`);
    }
  }

  // Project
  if (obj.project) {
    const projectIds = (config.projects || []).map(p => p.id);
    if (projectIds.length > 0 && !projectIds.includes(obj.project)) {
      warnings.push(`unknown project: ${obj.project} (configured: ${projectIds.join(", ")})`);
    }
  }

  // Dates
  for (const dateField of ["created_at", "updated_at"]) {
    if (obj[dateField] && !ISO_DATE_RE.test(String(obj[dateField]))) {
      errors.push(`invalid ${dateField}: ${obj[dateField]} (expected ISO 8601)`);
    }
  }

  // Relations shape
  if (obj.relations) {
    if (typeof obj.relations !== "object" || Array.isArray(obj.relations)) {
      errors.push(`relations must be an object`);
    } else {
      for (const k of ["files", "decisions", "bugs", "modules"]) {
        if (obj.relations[k] !== undefined && !Array.isArray(obj.relations[k])) {
          errors.push(`relations.${k} must be an array`);
        }
      }
    }
  }

  // Tags
  if (obj.tags !== undefined && !Array.isArray(obj.tags)) {
    errors.push(`tags must be an array`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function isContextExcluded(obj, config = getConfig()) {
  return config.context_excluded_status.includes(obj.status);
}
