const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const spritePath = path.join(root, 'assets/icons/lucide-sprite.svg');

function sourceFiles(directory, extensions) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === '.git' || entry.name === 'node_modules') return [];
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(fullPath, extensions);
        return entry.isFile() && extensions.has(path.extname(entry.name)) ? [fullPath] : [];
    });
}

test('every referenced Lucide icon exists in the bundled sprite', () => {
    const sprite = fs.readFileSync(spritePath, 'utf8');
    const symbols = new Set([...sprite.matchAll(/<symbol\s+id="([^"]+)"/g)].map(match => match[1]));
    const files = sourceFiles(root, new Set(['.html', '.js', '.css']));
    const references = new Set();

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const match of content.matchAll(/icon-lucide-([a-z0-9-]+)/g)) {
            if (match[1] !== 'chevron-') references.add(match[1]);
        }
    }

    assert.ok(references.size > 0, 'expected icon references in application source');
    assert.deepEqual([...references].filter(name => !symbols.has(name)), []);
    const nestedReferences = [...sprite.matchAll(/<use\b[^>]*href="#([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual([...new Set(nestedReferences)].filter(name => !symbols.has(name)), [],
        'every nested sprite reference must resolve to a bundled symbol');
});

test('HTML pages use the local icon renderer and sprite instead of a Bootstrap Icons CDN', () => {
    const files = sourceFiles(root, new Set(['.html']));
    assert.ok(files.length > 0);
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(content, /bootstrap-icons/i, path.relative(root, file));
        assert.match(content, /<script src=["'][^"']*assets\/js\/core\/icons\.js["']/, path.relative(root, file));
    }

    const renderer = fs.readFileSync(path.join(root, 'assets/js/core/icons.js'), 'utf8');
    assert.match(renderer, /lucide-sprite\.svg/);
});

test('empty-state icons use a circle container and compact Lucide glyph', () => {
    const iconsCss = fs.readFileSync(path.join(root, 'assets/css/components/icons.css'), 'utf8');
    assert.match(iconsCss, /\.empty-icon-circle\s*\{[^}]*border-radius:\s*50%/s);
    assert.match(iconsCss, /\.empty-icon-circle\s*>\s*\.lucide-icon\s*\{[^}]*width:\s*1\.15rem;[^}]*height:\s*1\.15rem/s);

    for (const [file, wrapperClass] of [
        ['assets/js/modules/ai-quiz-maker.js', 'aqm-history-empty-icon'],
        ['assets/js/modules/ai-flashcard-maker.js', 'aqm-history-empty-icon'],
        ['assets/js/modules/ai-study-assistant.js', 'asa-history-empty-icon'],
    ]) {
        const content = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(content, new RegExp(`${wrapperClass} empty-icon-circle`), `${file} history empty state must retain its circle`);
    }
});
