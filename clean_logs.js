import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const srcDir = path.resolve(__dirname, 'src');
const files = walk(srcDir);

// This regex handles up to 2 levels of nested parentheses inside console.log()
const consoleRegex = /console\.(log|error|warn|debug|info|table|group|groupEnd|groupCollapsed|time|timeEnd)\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\);?/g;

let totalCleaned = 0;
files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const newContent = content.replace(consoleRegex, '');
        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            totalCleaned++;
        }
    } catch (err) {
        process.stderr.write(`Failed to process ${file}: ${err.message}\n`);
    }
});

process.stdout.write(`Successfully cleaned ${totalCleaned} files.\n`);
