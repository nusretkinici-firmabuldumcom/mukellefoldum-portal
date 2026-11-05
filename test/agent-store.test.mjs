import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentStore} from '../agent-store.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'mukellefoldum-test-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return agentStore(root,async()=>[{id:'firm-1'}]);
}
const pdf=Buffer.from('%PDF-1.7\nvalid test');

test('accepts supported invoice and stores it in firm-period workspace',async t=>{
 const store=await fixture(t);
 const result=await store.upload('firm-1','2026-10','invoice.pdf',pdf,'purchase');
 assert.equal(result.result.duplicate,false);
 assert.equal(result.result.document.type,'Alış faturası');
 assert.equal((await store.read('firm-1','2026-10')).docs.length,1);
});

test('detects duplicate bytes within the same firm and period',async t=>{
 const store=await fixture(t);
 await store.upload('firm-1','2026-10','first.pdf',pdf,'purchase');
 const duplicate=await store.upload('firm-1','2026-10','copy.pdf',pdf,'expense');
 assert.equal(duplicate.result.duplicate,true);
 assert.equal((await store.read('firm-1','2026-10')).docs.length,1);
});

test('rejects a mismatched signature, invalid period, unknown firm and unsafe XML',async t=>{
 const store=await fixture(t);
 await assert.rejects(store.upload('firm-1','2026-10','fake.pdf',Buffer.from('not pdf'),'purchase'),/biçimi uyuşmuyor/);
 await assert.rejects(store.upload('firm-1','2026-13','ok.pdf',pdf,'purchase'),/geçersiz/);
 await assert.rejects(store.upload('missing','2026-10','ok.pdf',pdf,'purchase'),/kayıtlı bir firma/);
 await assert.rejects(store.upload('firm-1','2026-10','unsafe.xml',Buffer.from('<!DOCTYPE x><x/>'),'purchase'),/güvenli bir XML/);
});

test('file reads are limited to the requested firm and period',async t=>{
 const store=await fixture(t);
 const uploaded=await store.upload('firm-1','2026-10','invoice.pdf',pdf,'purchase');
 const id=uploaded.result.document.id;
 const found=await store.file('firm-1','2026-10',id);
 assert.deepEqual(found.bytes,pdf);
 await assert.rejects(store.file('firm-1','2026-09',id),/Belge bulunamadı/);
});
