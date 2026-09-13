'use strict';
// Goldens are generated exclusively from this checkout's JavaScript combat engine.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {loadFixtures,runReference,comparableReport} = require('./reference-engine');
const root=path.resolve(__dirname,'../..');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const reports=Object.fromEntries(loadFixtures().map(f=>[f.name,comparableReport(runReference(f))]));
fs.writeFileSync(path.join(__dirname,'golden-reports.json'),JSON.stringify({oracle:'destination JavaScript; no native execution',revision,reports},null,2)+'\n');
