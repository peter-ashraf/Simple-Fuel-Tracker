const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const srcDir = 'f:/Peter/Practice/Fuel-Tracker/src';
const files = walk(srcDir);
// Use a more aggressive regex for multi-line and common patterns
// This matches console.log(...) and optional trailing semicolon
const consoleRegex = /console\.(log|error|warn|debug|info|table|group|groupEnd|groupCollapsed|time|timeEnd)\s*\(\s*([\s\S]*?)\s*\);?/g;

let totalCleaned = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content.replace(consoleRegex, '');
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        totalCleaned++;
    }
});

process.stdout.write(`Successfully cleaned ${totalCleaned} files.`);
