import { request } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, utimesSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildGraphSync as buildGraph } from '../src/graph/build.mjs';
import { reviewCommand } from '../src/cli/review.mjs';
import { checkCommand } from '../src/cli/check.mjs';
import { getChangedFiles } from '../src/query/git-activity.mjs';
import { serve } from '../src/dashboard/server.mjs';
import { objectPath, readObject } from '../src/markdown/object.mjs';
import { createObject, closeObject } from '../src/markdown/write-ops.mjs';
import { createBrainMcp } from '../src/mcp/server.mjs';
import * as proc from '../src/dashboard/proc.mjs';
import { gatherGuard } from '../src/query/guard.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'brain-hardening-'));
  t.after(() => rmSync(root, { recursive:true, force:true }));
  const brainRoot = join(root,'.serif-brain');
  mkdirSync(join(brainRoot,'graph'), {recursive:true});
  mkdirSync(join(root,'src'));
  writeFileSync(join(brainRoot,'config.yaml'), `projects:\n  - { id: demo, active: true }\nvalid_modules: [ui, db, unknown]\nvalid_status: [open, active, done, rejected, archived]\nvalid_priority: [low, medium, high, critical]\nmodule_paths:\n  "src/a.mjs": ui\n  "src/b.mjs": db\nlayer_rules:\n  - { from: ui, to: db, reason: forbidden }\nbug_signatures:\n  - { name: unsafe, pattern: DANGER, message: unsafe }\n`);
  writeFileSync(join(root,'src/a.mjs'),'export const a = 1;\n');
  writeFileSync(join(root,'src/b.mjs'),'export const b = 2;\n');
  const git = (...a) => execFileSync('git',['-C',root,...a],{stdio:'ignore'});
  git('init','-q');git('config','user.name','Test');git('config','user.email','test@localhost');git('add','.');git('commit','-qm','base');
  return {root,brainRoot,git};
}
async function capture(fn) {
  const old=console.log, lines=[];
  console.log=(...a)=>lines.push(a.join(' '));
  try { return {exit:await fn(), data:JSON.parse(lines.join('\n'))}; }
  finally { console.log=old; }
}

test('live review and check catch a newly added forbidden import despite saved clean graph', async t => {
  const {root,brainRoot}=fixture(t);
  writeFileSync(join(brainRoot,'graph/graph.json'),JSON.stringify(buildGraph({projectRoot:root,brainRoot})));
  writeFileSync(join(root,'src/a.mjs'),"import './b.mjs';\n");
  const args={flags:{project:root,json:true}};
  const review=await capture(()=>reviewCommand({args}));
  assert.equal(review.exit,2);assert.equal(review.data.coverage.mode,'live');
  const check=await capture(()=>checkCommand({args,subcommand:['src/a.mjs']}));
  assert.equal(check.exit,2);assert.equal(check.data.layer_violations.length,1);
  const mcp=createBrainMcp({brainRoot});
  const result=await mcp.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'brain_check',arguments:{path:'src/a.mjs'}}});
  assert.equal(JSON.parse(result.result.content[0].text).ok,false);
});

test('live review scans Python PHP Ruby Astro and reports unsupported structural languages',async t=>{
  const {root}=fixture(t);
  for(const ext of ['py','php','rb','astro','swift']) writeFileSync(join(root,`src/new.${ext}`),'DANGER\n');
  const r=await capture(()=>reviewCommand({args:{flags:{project:root,json:true}}}));
  assert.equal(r.exit,2);assert.equal(r.data.flagged,5);
  assert.equal(r.data.coverage.checked,4);
  assert.deepEqual(r.data.coverage.out_of_scope_files,['src/new.swift']);
});

test('graph cache: equal-size edit with NEW mtime is detected; same content with new mtime is a cache hit',t=>{
  const {root,brainRoot}=fixture(t), file=join(root,'src/a.mjs');
  writeFileSync(file,"import './b.mjs';\n");
  buildGraph({projectRoot:root,brainRoot});
  // Ayni boyut, farkli icerik, ILERI mtime → ozet farkli → yeniden parse.
  writeFileSync(file,"import './c.mjs';\n");utimesSync(file,new Date(Date.now()+5000),new Date(Date.now()+5000));
  const g1=buildGraph({projectRoot:root,brainRoot});
  assert.equal(g1.edges.some(e=>e.type==='imports'&&e.source==='file:src/a.mjs'),false);
  // Ayni icerik, yine ILERI mtime (dal degistirme gibi) → ozet ayni → cache isabeti.
  utimesSync(file,new Date(Date.now()+10000),new Date(Date.now()+10000));
  const g2=buildGraph({projectRoot:root,brainRoot});
  assert.equal(g2.stats.cache_hits,2,'mtime yenilenen ama icerigi ayni dosya yeniden parse edilmemeli');
});

test('guard builds a live graph by default and only reads the saved snapshot with snapshot:true',t=>{
  const {root,brainRoot}=fixture(t);
  writeFileSync(join(brainRoot,'graph/graph.json'),JSON.stringify(buildGraph({projectRoot:root,brainRoot})));
  writeFileSync(join(root,'src/b.mjs'),"import './a.mjs';\nexport const b = 2;\n");
  const live=gatherGuard({projectRoot:root,brainRoot,relPath:'src/a.mjs'});
  assert.equal(live.blast_radius.direct_dependents,1,'canli graf yeni bagimliyi gormeli');
  const snap=gatherGuard({projectRoot:root,brainRoot,relPath:'src/a.mjs',snapshot:true});
  assert.equal(snap.blast_radius.direct_dependents,0,'snapshot kipi kayitli grafi okur');
});

test('git paths remain relative to nested project and preserve whitespace',t=>{
  const {root,git}=fixture(t);
  mkdirSync(join(root,'app'));writeFileSync(join(root,'app/a b.mjs'),'one');
  git('add','.');git('commit','-qm','nested');
  writeFileSync(join(root,'app/a b.mjs'),'two');
  assert.deepEqual(getChangedFiles(join(root,'app')),['a b.mjs']);
});

test('closed notes retain rejected and archived states; paths cannot escape storage',t=>{
  const {root,brainRoot}=fixture(t);
  for(const status of ['rejected','archived']) {
    const o=createObject({brainRoot,projectRoot:root,type:'decision',title:status,status,files:[],body:'Reason'});
    const result=closeObject({brainRoot,id:o.id,note:'More evidence'});
    assert.equal(result.status,status);assert.equal(readObject(o.path).frontmatter.status,status);
  }
  assert.throws(()=>objectPath(brainRoot,'../../outside','bug','bug-safe'),/invalid/);
  assert.throws(()=>objectPath(brainRoot,'demo','bug','../../outside'),/invalid/);
});

test('dashboard rejects foreign origins hosts and non-JSON writes, accepts same-origin JSON',async t=>{
  const {server,port}=await serve({port:0});
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(base+'/api/health',{headers:{origin:'https://untrusted.example'}})).status,403);
  assert.equal(await new Promise((resolve,reject)=>{const req=request(base+'/api/health',{headers:{host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
  assert.equal((await fetch(base+'/api/start',{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/health',{headers:{origin:base}})).status,200);
  assert.equal((await fetch(base+'/api/start',{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400);
  assert.throws(()=>serve({port:0,host:'0.0.0.0'}),/127/);
});

test('stop terminates the child server as well as its shell',async t=>{
  const {root}=fixture(t);
  const ready=join(root,'ready');
  writeFileSync(join(root,'child.cjs'),`require('node:fs').writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},1000);`);
  // Extra shell command keeps the shell alive instead of allowing exec optimization.
  proc.start(root,process.platform==='win32' ? 'node child.cjs' : 'node child.cjs & wait',null);
  let pid;
  try {
    for(let n=0;n<100;n++) {try{pid=Number(readFileSync(ready,'utf8'));break;}catch{} await new Promise(r=>setTimeout(r,20));}
    assert.ok(pid,'child started');
    assert.equal((await proc.stop(root)).ok,true);
    let alive=true;
    for(let n=0;n<100;n++) {try{process.kill(pid,0);}catch{alive=false;break;}await new Promise(r=>setTimeout(r,20));}
    assert.equal(alive,false,'descendant must stop');
  }finally {await proc.stop(root);if(pid)try{process.kill(pid,'SIGKILL');}catch{}}
});
