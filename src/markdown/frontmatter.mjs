// Frontmatter ayirici: --- YAML --- body
import { parseYaml, serializeYaml } from "./yaml.mjs";

const DELIM = /^---\s*$/;

export function parseFrontmatter(text) {
  const lines = text.split("\n");
  if (lines.length < 2 || !DELIM.test(lines[0])) {
    return { frontmatter: {}, body: text, has_frontmatter: false };
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (DELIM.test(lines[i])) { endIdx = i; break; }
  }
  if (endIdx < 0) {
    throw new Error("Frontmatter delimiter not closed (missing second '---')");
  }
  const yamlBlock = lines.slice(1, endIdx).join("\n");
  const body = lines.slice(endIdx + 1).join("\n");
  return {
    frontmatter: parseYaml(yamlBlock) || {},
    body,
    has_frontmatter: true
  };
}

export function serializeFrontmatter(frontmatter, body) {
  const yaml = serializeYaml(frontmatter).replace(/\n$/, "");
  const cleanBody = body.startsWith("\n") ? body : "\n" + body;
  return `---\n${yaml}\n---${cleanBody}`;
}
