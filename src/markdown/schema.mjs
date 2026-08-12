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

// Bir enum anahtarini guvenle dogrular: anahtar yoksa COKMEZ, ANLAMLI hata verir.
function enumKontrol(errors, config, anahtar, deger, alanAdi) {
  if (!deger) return;
  const liste = config?.[anahtar];
  if (!Array.isArray(liste)) {
    errors.push(`config.yaml eksik: ${anahtar} tanimli degil — ${alanAdi} dogrulanamiyor`);
    return;
  }
  if (!liste.includes(deger)) {
    errors.push(`invalid ${alanAdi}: ${deger} (valid: ${liste.join(", ")})`);
  }
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

  // Status / Priority enum
  //
  // Eskiden dogrudan `config.valid_status.includes(...)` yaziliyordu ve anahtar
  // config'te YOKSA TypeError atiyordu: eksik bir yapilandirma satiri, anlamli
  // hata yerine COKME uretiyordu (yigin izi, "Cannot read properties of
  // undefined"). Kullanici neyin eksik oldugunu goremiyordu.
  //
  // Fail-loud korunuyor ama DOGRU sekilde: eksik anahtar bir SEMA HATASI olarak
  // bildirilir. Sessizce "her deger gecerli" saymak da yanlis olurdu — o zaman
  // bozuk config sessizce her seyi kabul ederdi.
  enumKontrol(errors, config, "valid_status", obj.status, "status");
  enumKontrol(errors, config, "valid_priority", obj.priority, "priority");

  // Severity (bug only) — kendi enum'u (valid_severity); yoksa geriye-uyumlu
  // olarak valid_priority'ye düş. Önceden daima valid_priority kullanılıyordu →
  // ayrı bir severity ölçeği (örn. blocker/major/minor) tanımlanamıyordu.
  if (type === "bug" && obj.severity) {
    const validSeverity = config.valid_severity || config.valid_priority;
    if (!Array.isArray(validSeverity)) {
      errors.push(`config.yaml eksik: valid_severity (ya da valid_priority) tanimli degil — severity dogrulanamiyor`);
    } else if (!validSeverity.includes(obj.severity)) {
      errors.push(`invalid severity: ${obj.severity} (valid: ${validSeverity.join(", ")})`);
    }
  }

  // Module(s)
  const modules = Array.isArray(obj.module) ? obj.module : (obj.module ? [obj.module] : []);
  const gecerliModuller = Array.isArray(config.valid_modules) ? config.valid_modules : null;
  if (!gecerliModuller && modules.length) {
    errors.push(`config.yaml eksik: valid_modules tanimli degil — modul dogrulanamiyor`);
  }
  for (const m of gecerliModuller ? modules : []) {
    if (!gecerliModuller.includes(m)) {
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
