// Deterministic, disposable graph workload. Never touches a user's projects.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildGraphSync as buildGraph } from '../src/graph/build.mjs';
const count=Number(process.argv[2] || 1000);
if(!Number.isInteger(count)||count<2||count>10000) throw new Error('file count must be 2..10000');
const root=mkdtempSync(join(tmpdir(),'brain-benchmark-'));
try {
  const brainRoot=join(root,'.serif-brain');mkdirSync(brainRoot);mkdirSync(join(root,'src'));
  for(let i=0;i<count;i++) writeFileSync(join(root,`src/f${i}.mjs`),i ? `import './f${i-1}.mjs';\nexport const v=${i};\n`:'export const v=0;\n');
  const samples=[];let graph;
  for(let i=0;i<6;i++){const start=performance.now();graph=buildGraph({projectRoot:root,brainRoot});samples.push(performance.now()-start);}
  const edges=graph.edges.filter(e=>e.type==='imports').length;
  if(edges!==count-1) throw new Error(`incorrect graph: ${edges}`);
  console.log(JSON.stringify({node:process.version,platform:process.platform,files:count,import_edges:edges,cold_ms:samples[0],warm_ms:samples.slice(1),warm_max_ms:Math.max(...samples.slice(1)),cache_hits:graph.stats.cache_hits,scope:'synthetic chain; graph build only, not end-to-end hook latency'},null,2));
} finally {rmSync(root,{recursive:true,force:true});}
