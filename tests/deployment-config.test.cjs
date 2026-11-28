const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('Vercel redirects point only to existing app and auth pages', () => {
    for (const rule of config.redirects) {
        const aliases = rule.source.match(/\(([^)]+)\)/)?.[1]?.split('|') || [];
        assert.ok(aliases.length, `Could not inspect redirect source ${rule.source}`);
        for (const alias of aliases) {
            const destination = rule.destination.replace('$1', alias).replace(/^\//, '');
            assert.ok(fs.existsSync(path.join(root, destination)), `${rule.source} points to missing ${destination}`);
        }
    }
});

test('global production headers retain baseline transport and content protections', () => {
    const rule = config.headers.find(item => item.source === '/(.*)');
    const headers = Object.fromEntries(rule.headers.map(header => [header.key.toLowerCase(), header.value]));
    assert.match(headers['strict-transport-security'], /max-age=/);
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
});
