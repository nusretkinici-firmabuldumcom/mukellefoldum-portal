// Passenger entrypoint. Deploy as app.cjs beside server.mjs, outside public_html.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const privateRoot=path.join(__dirname,'..','mukellefoldum-private');
fs.mkdirSync(privateRoot,{recursive:true,mode:0o700});
const credentialPath=path.join(privateRoot,'advisor-access.json');
if(!fs.existsSync(credentialPath))fs.writeFileSync(credentialPath,JSON.stringify({username:'muhasebe',password:crypto.randomBytes(24).toString('base64url')}),{flag:'wx',mode:0o600});
const access=JSON.parse(fs.readFileSync(credentialPath,'utf8'));
process.env.DEPLOYMENT_MODE='cloud';process.env.APP_HOST='mukellefoldum.com';
process.env.APP_USER=access.username;process.env.APP_PASSWORD=access.password;
process.env.DATA_ROOT=privateRoot;process.env.PUBLIC_LANDING_ROOT='1';
import('./server.mjs').catch(()=>{console.error('Application startup failed.');process.exit(1);});
