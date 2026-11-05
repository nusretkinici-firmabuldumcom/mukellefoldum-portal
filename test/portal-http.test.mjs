import test from 'node:test';
import assert from 'node:assert/strict';
import {portalHttp} from '../portal-http.mjs';

function response(){return {status:0,headers:{},body:'',writeHead(status,headers={}){this.status=status;this.headers=headers;},setHeader(name,value){this.headers[name]=value;},end(body=''){this.body=body;}};}
function request(url,cookie='luca_session=tax-token'){
 return {method:'GET',url,headers:{cookie},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){}};
}
function harness(){
 const calls=[];
 const handler=portalHttp({
  startup:{},portal:{async session(token){return token==='tax-token'?{role:'taxpayer',firmId:'firm-owned',userId:'user-1'}:null;},logout(){}},
  archive:{async read(firmId,period){calls.push({kind:'read',firmId,period});return {docs:[]};},async file(firmId,period,id){calls.push({kind:'file',firmId,period,id});return {doc:{name:'receipt.pdf'},bytes:Buffer.from('ok')};}},
  firms:async()=>[{id:'firm-owned'},{id:'firm-other'}],json:(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));},body:async()=>Buffer.alloc(0),cloud:false,admin:{}
 });
 return {handler,calls};
}

test('taxpayer document listing ignores caller-supplied firm IDs',async()=>{
 const {handler,calls}=harness(),res=response();
 await handler(request('/api/client/documents?firmId=firm-other&period=2026-10'),res,'/api/client/documents');
 assert.equal(res.status,200);
 assert.deepEqual(calls,[{kind:'read',firmId:'firm-owned',period:'2026-10'}]);
});

test('taxpayer file reads stay scoped to the authenticated firm',async()=>{
 const {handler,calls}=harness(),res=response();
 await handler(request('/api/client/file?firmId=firm-other&period=2026-10&id=doc-1'),res,'/api/client/file');
 assert.equal(res.status,200);
 assert.deepEqual(calls,[{kind:'file',firmId:'firm-owned',period:'2026-10',id:'doc-1'}]);
});

test('unauthenticated callers cannot read client documents',async()=>{
 const {handler}=harness(),res=response();
 await handler(request('/api/client/documents?period=2026-10',''),res,'/api/client/documents');
 assert.equal(res.status,401);
});
