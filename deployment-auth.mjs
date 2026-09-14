import {timingSafeEqual} from 'node:crypto';
export function validBasicAuth(header,username,password){if(!username||!password||!header?.startsWith('Basic '))return false;const supplied=Buffer.from(header.slice(6),'base64');const expected=Buffer.from(username+':'+password);return supplied.length===expected.length&&timingSafeEqual(supplied,expected);}
