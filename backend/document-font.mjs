import {mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const fontDirectory=fileURLToPath(new URL('./assets/',import.meta.url));
const configDirectory=join(tmpdir(),'cpx-fontconfig');
const cacheDirectory=join(configDirectory,'cache');
const configPath=join(configDirectory,'fonts.conf');

mkdirSync(cacheDirectory,{recursive:true});
writeFileSync(configPath,`<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDirectory}</dir>
  <cachedir>${cacheDirectory}</cachedir>
</fontconfig>`);

// The hosted Railway image does not include a usable default font collection.
// Configure Fontconfig before Sharp/librsvg is loaded so accented text is rendered.
process.env.FONTCONFIG_FILE=configPath;
process.env.FONTCONFIG_PATH=dirname(configPath);

let sharpPromise;
export const loadDocumentRenderer=()=>sharpPromise??=(import('sharp').then(module=>module.default));
export const documentFontStyle=`text{font-family:'DejaVu Sans';font-style:normal}`;
