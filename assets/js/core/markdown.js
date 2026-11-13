// CHAT MARKDOWN RENDERER
//
// A small, dependency-free Markdown → HTML renderer used to render
// AI-generated chat responses (AI Study Assistant, AI Quiz Maker, AI
// Flashcard Maker, etc.) so they look like properly formatted answers
// instead of raw Markdown syntax.
//
// Safety: every piece of literal text that reaches the output passes
// through escHtml() before any tag is wrapped around it. The renderer
// never inserts the AI's raw text as HTML, and links are restricted to
// http(s)/mailto/relative URLs — the same allow-list already used by the
// notes editor's Markdown renderer. No external library or network
// request is involved, so this works fully offline.
//
// Supported: headings, bold/italic/strikethrough, inline code, fenced
// code blocks (with light, built-in syntax highlighting), ordered/
// unordered/nested lists, blockquotes, horizontal rules, GFM-style pipe
// tables, links, and paragraph/line-break spacing. Inline and block math
// ($...$ / $$...$$) gets a lightweight LaTeX-to-HTML pass (exponents,
// subscripts, fractions, square roots, Greek letters and common operators)
// rather than a full TeX layout engine, since no math-typesetting library
// is bundled with the app — good enough for the numbers/equations an AI
// study answer typically contains without needing a network fetch.
//
// Usage: renderChatMarkdown(text) -> HTML string. Call repeatedly with the
// full message text (not just a delta) — it always rebuilds the whole
// message from scratch, so re-rendering a growing streamed response never
// duplicates or flickers old content; it just replaces it.

(function (global) {
    'use strict';

    const esc = (typeof escHtml === 'function') ? escHtml : function (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const LIST_LINE = /^([ \t]*)([-*+]|\d+[.)])(?:[ \t]+(.*))?$/;

    // Emphasis markers only count when they hug the text (no space just inside).
    function emphasis(html) {
        return html
            .replace(/\*\*\*(\S(?:[^\n]*?\S)?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(\S(?:[^\n]*?\S)?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(\S(?:[^*\n]*?\S)?)\*/g, '<em>$1</em>')
            .replace(/(^|[^\w])_(\S(?:[^_\n]*?\S)?)_(?!\w)/g, '$1<em>$2</em>')
            .replace(/~~(\S(?:[^\n]*?\S)?)~~/g, '<del>$1</del>');
    }

    // --- Lightweight LaTeX-ish math → HTML --------------------------------
    // Operates on text that has ALREADY been through esc() (callers below
    // guarantee this), so backslashes/braces/^/_ are all still literal and
    // safe to pattern-match on; no new unescaped text is ever introduced.
    // Command names are matched with a "not followed by another letter"
    // lookahead rather than \b, because \b treats "_" and digits as word
    // characters too — "\sum_{i}" has no \b between "m" and "_", which
    // would silently leave "\sum" unconverted right when a limit follows it.
    function mathCmd(name) { return new RegExp('\\\\' + name + '(?![a-zA-Z])', 'g'); }
    const MATH_SYMBOLS = [
        [mathCmd('neq'), '≠'], [mathCmd('leq'), '≤'], [mathCmd('geq'), '≥'], [mathCmd('approx'), '≈'],
        [mathCmd('equiv'), '≡'], [mathCmd('sim'), '∼'], [mathCmd('propto'), '∝'],
        [mathCmd('times'), '×'], [mathCmd('cdot'), '·'], [mathCmd('div'), '÷'], [mathCmd('pm'), '±'], [mathCmd('mp'), '∓'],
        [mathCmd('infty'), '∞'], [mathCmd('partial'), '∂'], [mathCmd('nabla'), '∇'],
        [mathCmd('sum'), '∑'], [mathCmd('prod'), '∏'], [mathCmd('oint'), '∮'], [mathCmd('int'), '∫'],
        [mathCmd('notin'), '∉'], [mathCmd('in'), '∈'], [mathCmd('subseteq'), '⊆'], [mathCmd('subset'), '⊂'], [mathCmd('supset'), '⊃'],
        [mathCmd('cup'), '∪'], [mathCmd('cap'), '∩'], [mathCmd('emptyset'), '∅'],
        [mathCmd('forall'), '∀'], [mathCmd('exists'), '∃'],
        [mathCmd('Leftrightarrow'), '⇔'], [mathCmd('Rightarrow'), '⇒'], [mathCmd('Leftarrow'), '⇐'],
        [mathCmd('leftrightarrow'), '↔'], [mathCmd('rightarrow'), '→'], [mathCmd('leftarrow'), '←'], [mathCmd('to'), '→'], [mathCmd('mapsto'), '↦'],
        [mathCmd('cdots'), '⋯'], [mathCmd('ldots'), '…'], [mathCmd('dots'), '…'], [mathCmd('vdots'), '⋮'], [mathCmd('ddots'), '⋱'],
        [mathCmd('degree'), '°'], [mathCmd('angle'), '∠'], [mathCmd('perp'), '⊥'], [mathCmd('parallel'), '∥'],
        [mathCmd('Delta'), 'Δ'], [mathCmd('delta'), 'δ'], [mathCmd('alpha'), 'α'], [mathCmd('beta'), 'β'], [mathCmd('Gamma'), 'Γ'], [mathCmd('gamma'), 'γ'],
        [mathCmd('varepsilon'), 'ε'], [mathCmd('epsilon'), 'ε'], [mathCmd('zeta'), 'ζ'], [mathCmd('eta'), 'η'],
        [mathCmd('Theta'), 'Θ'], [mathCmd('theta'), 'θ'], [mathCmd('iota'), 'ι'], [mathCmd('kappa'), 'κ'], [mathCmd('Lambda'), 'Λ'], [mathCmd('lambda'), 'λ'],
        [mathCmd('mu'), 'μ'], [mathCmd('nu'), 'ν'], [mathCmd('Xi'), 'Ξ'], [mathCmd('xi'), 'ξ'], [mathCmd('Pi'), 'Π'], [mathCmd('pi'), 'π'],
        [mathCmd('rho'), 'ρ'], [mathCmd('Sigma'), 'Σ'], [mathCmd('sigma'), 'σ'], [mathCmd('tau'), 'τ'], [mathCmd('upsilon'), 'υ'],
        [mathCmd('varphi'), 'φ'], [mathCmd('Phi'), 'Φ'], [mathCmd('phi'), 'φ'], [mathCmd('chi'), 'χ'], [mathCmd('Psi'), 'Ψ'], [mathCmd('psi'), 'ψ'],
        [mathCmd('Omega'), 'Ω'], [mathCmd('omega'), 'ω'],
    ];

    function mathApplySymbolsAndScripts(s) {
        MATH_SYMBOLS.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });
        s = s
            .replace(/\^\{([^{}]*)\}/g, '<sup class="md-math-sup">$1</sup>')
            .replace(/\^(\S)/g, '<sup class="md-math-sup">$1</sup>')
            .replace(/_\{([^{}]*)\}/g, '<sub class="md-math-sub">$1</sub>')
            .replace(/_(\S)/g, '<sub class="md-math-sub">$1</sub>');
        // Any grouping braces left over from an unrecognized command are just
        // noise visually, so drop them rather than show raw "{" / "}".
        return s.replace(/[{}]/g, '');
    }

    // src must already be HTML-escaped. Returns HTML (never introduces
    // unescaped text — every substitution below only inserts fixed markup
    // or unicode symbol characters around text that was already escaped).
    function mathToHtml(src) {
        let s = String(src || '')
            .replace(/\\left/g, '').replace(/\\right/g, '')
            .replace(/\\(?:,|;|!|:|quad|qquad)/g, ' ')
            .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$1');

        // \sqrt is resolved first — its replacement contains no braces, so
        // a \sqrt{...} nested inside a \frac{...}{...} argument (very common
        // in e.g. the quadratic formula) no longer blocks the frac regex
        // below, which only matches a brace group with no braces inside it.
        s = s.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, function (m, n, a) {
            return '<sup class="md-math-sup">' + n + '</sup><span class="md-math-sqrt-sign">√</span><span class="md-math-sqrt">' + mathApplySymbolsAndScripts(a) + '</span>';
        });
        s = s.replace(/\\sqrt\{([^{}]*)\}/g, function (m, a) {
            return '<span class="md-math-sqrt-sign">√</span><span class="md-math-sqrt">' + mathApplySymbolsAndScripts(a) + '</span>';
        });

        // \frac{a}{b} -> a stacked fraction. Handles one level of brace
        // nesting inside a or b (e.g. a \sqrt already resolved above) —
        // good enough for the typical algebra/stats expressions an AI
        // study answer produces; a \frac nested inside another \frac's
        // argument is the one case this won't unwrap.
        s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, function (m, num, den) {
            return '<span class="md-math-frac"><span class="md-math-num">' + mathApplySymbolsAndScripts(num) +
                '</span><span class="md-math-den">' + mathApplySymbolsAndScripts(den) + '</span></span>';
        });

        return mathApplySymbolsAndScripts(s);
    }

    // Parses inline spans (code, links, math, emphasis) for one logical line.
    function inline(text) {
        const code = [];
        const math = [];
        const links = [];
        const escaped = [];

        let html = esc(text)
            .replace(/\\(&gt;|[\\`*_{}\[\]()#+.!~$-])/g, function (match, character) {
                escaped.push(character === '&gt;' ? '>' : character);
                return '\u0002' + (escaped.length - 1) + '\u0002';
            })
            .replace(/`([^`]+)`/g, function (match, content) {
                code.push('<code class="md-inline-code">' + content + '</code>');
                return '\u0001' + (code.length - 1) + '\u0001';
            })
            .replace(/\$\$([^$]+)\$\$/g, function (match, content) {
                math.push('<span class="md-math-inline" title="Math expression">' + mathToHtml(content) + '</span>');
                return '\u0004' + (math.length - 1) + '\u0004';
            })
            .replace(/\$([^\s$](?:[^$\n]*[^\s$])?)\$/g, function (match, content) {
                math.push('<span class="md-math-inline" title="Math expression">' + mathToHtml(content) + '</span>');
                return '\u0004' + (math.length - 1) + '\u0004';
            })
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, href) {
                href = href.trim();
                if (!/^(https?:|mailto:|\/|#|\.{1,2}\/)/i.test(href))
                    return label;
                links.push({ label: label, href: href.replace(/"/g, '%22') });
                return '\u0003' + (links.length - 1) + '\u0003';
            });

        html = emphasis(html);
        html = html.replace(/\u0003(\d+)\u0003/g, function (match, i) {
            const link = links[Number(i)];
            return '<a href="' + link.href + '" target="_blank" rel="noopener noreferrer">' + emphasis(link.label) + '</a>';
        });
        html = html.replace(/\u0004(\d+)\u0004/g, function (match, i) { return math[Number(i)]; });
        html = html.replace(/\u0001(\d+)\u0001/g, function (match, i) { return code[Number(i)]; });
        html = html.replace(/\u0002(\d+)\u0002/g, function (match, i) { return esc(escaped[Number(i)]); });
        return html;
    }

    // Very small, dependency-free syntax highlighter. Good enough to pick out
    // comments/strings/numbers/keywords for common languages without a 3rd
    // party library; anything it doesn't recognize is left as plain escaped text.
    const HL_KEYWORDS = /\b(function|return|const|let|var|if|else|for|while|do|switch|case|break|continue|class|extends|new|import|export|from|default|try|catch|finally|throw|async|await|yield|typeof|instanceof|null|undefined|true|false|this|super|void|delete|in|of|def|elif|lambda|pass|with|as|is|not|and|or|None|True|False|self|public|private|protected|static|interface|implements|package|namespace|using|echo|end|then|fn|match|impl|struct|enum|trait|mod|pub|fi|esac|done)\b/g;

    function highlightCode(src) {
        const lines = esc(src).split('\n');
        return lines.map(function (line) {
            // Order matters: comments/strings are pulled out first so keyword/
            // number matching never runs inside them. Placeholder tokens are
            // letter-prefixed (not bare digits) so the number highlighter below
            // can't mistake a placeholder's index for a number to wrap.
            let out = line.replace(/(\/\/.*$|#.*$)/g, '\u0005$1\u0005');
            const comments = [];
            out = out.replace(/\u0005([^\u0005]*)\u0005/g, function (m, c) {
                comments.push('<span class="hl-comment">' + c + '</span>');
                return '\u0006c' + (comments.length - 1) + '\u0006';
            });
            const strings = [];
            out = out.replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;|'(?:[^'\\]|\\.)*')/g, function (m) {
                strings.push('<span class="hl-string">' + m + '</span>');
                return '\u0007s' + (strings.length - 1) + '\u0007';
            });
            out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>');
            out = out.replace(HL_KEYWORDS, '<span class="hl-keyword">$1</span>');
            out = out.replace(/\u0007s(\d+)\u0007/g, function (m, i) { return strings[Number(i)]; });
            out = out.replace(/\u0006c(\d+)\u0006/g, function (m, i) { return comments[Number(i)]; });
            return out;
        }).join('\n');
    }

    function parseListLine(line) {
        const m = line.replace(/\t/g, '    ').match(LIST_LINE);
        if (!m) return null;
        const item = { indent: m[1].length, text: m[3] || '', kind: 'ul', num: 1 };
        if (/^\d/.test(m[2])) {
            item.kind = 'ol';
            item.num = Number(m[2].replace(/\D/g, ''));
        }
        return item;
    }

    // Builds (possibly nested) <ul>/<ol> markup from a run of list lines.
    function listHtml(items) {
        const stack = [];
        items.forEach(function (item) {
            while (stack.length && stack[stack.length - 1] > item.indent) stack.pop();
            if (!stack.length || stack[stack.length - 1] < item.indent) stack.push(item.indent);
            item.level = stack.length - 1;
        });
        let pos = 0;
        function itemHtml(item, nested) {
            return '<li>' + inline(item.text) + nested + '</li>';
        }
        function build(level) {
            const kind = items[pos].kind;
            let html = '';
            while (pos < items.length && items[pos].level >= level && items[pos].kind === kind) {
                const item = items[pos++];
                let nested = '';
                while (pos < items.length && items[pos].level > level) nested += build(level + 1);
                html += itemHtml(item, nested);
            }
            if (kind === 'ol') return '<ol class="md-ol"' + (items[0].num === 1 ? '' : ' start="' + items[0].num + '"') + '>' + html + '</ol>';
            return '<ul class="md-ul">' + html + '</ul>';
        }
        let out = '';
        while (pos < items.length) out += build(0);
        return out;
    }

    function isTableSeparator(line) {
        return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
    }

    function splitTableRow(line) {
        let trimmed = line.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
        const cells = [];
        let cur = '';
        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];
            if (ch === '\\' && trimmed[i + 1] === '|') { cur += '|'; i++; continue; }
            if (ch === '|') { cells.push(cur); cur = ''; continue; }
            cur += ch;
        }
        cells.push(cur);
        return cells.map(function (c) { return c.trim(); });
    }

    function tableHtml(headerLine, alignLine, bodyLines) {
        const headers = splitTableRow(headerLine);
        const aligns = splitTableRow(alignLine).map(function (cell) {
            const left = cell.startsWith(':');
            const right = cell.endsWith(':');
            if (left && right) return 'center';
            if (right) return 'right';
            if (left) return 'left';
            return '';
        });
        const theadCells = headers.map(function (h, i) {
            const align = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
            return '<th' + align + '>' + inline(h) + '</th>';
        }).join('');
        const tbodyRows = bodyLines.map(function (line) {
            const cells = splitTableRow(line);
            const tds = headers.map(function (_, i) {
                const align = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
                return '<td' + align + '>' + inline(cells[i] || '') + '</td>';
            }).join('');
            return '<tr>' + tds + '</tr>';
        }).join('');
        return '<div class="md-table-wrap"><table class="md-table"><thead><tr>' + theadCells + '</tr></thead><tbody>' + tbodyRows + '</tbody></table></div>';
    }

    function renderChatMarkdown(src) {
        const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
        const output = [];
        let paragraph = [];

        function flushParagraph() {
            if (paragraph.length) {
                output.push('<p class="md-p">' + paragraph.map(inline).join('<br>') + '</p>');
                paragraph = [];
            }
        }

        for (let index = 0; index < lines.length;) {
            const line = lines[index];
            const fence = line.match(/^\s*```(\S*)\s*$/);
            const heading = line.match(/^(#{1,6})\s+(.+)$/);
            const quote = line.match(/^ {0,3}>[ \t]?(.*)$/);
            const hr = /^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line);
            const mathBlockStart = line.match(/^\s*\$\$\s*$/);

            if (!line.trim()) { flushParagraph(); index++; continue; }

            if (fence) {
                flushParagraph();
                const lang = (fence[1] || '').trim();
                const codeLines = [];
                index++;
                while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { codeLines.push(lines[index]); index++; }
                if (index < lines.length) index++;
                const code = codeLines.join('\n');
                const langLabel = lang ? '<div class="md-code-lang">' + esc(lang) + '</div>' : '';
                output.push('<div class="md-code-block">' + langLabel + '<pre><code class="hljs-lite">' + highlightCode(code) + '</code></pre></div>');
                continue;
            }

            if (mathBlockStart) {
                flushParagraph();
                const mathLines = [];
                index++;
                while (index < lines.length && !/^\s*\$\$\s*$/.test(lines[index])) { mathLines.push(lines[index]); index++; }
                if (index < lines.length) index++;
                output.push('<div class="md-math-block" title="Math expression">' + mathToHtml(esc(mathLines.join('\n'))) + '</div>');
                continue;
            }

            if (hr) { flushParagraph(); output.push('<hr class="md-hr">'); index++; continue; }

            if (heading) {
                flushParagraph();
                const level = heading[1].length;
                output.push('<h' + level + ' class="md-h">' + inline(heading[2]) + '</h' + level + '>');
                index++;
                continue;
            }

            if (quote) {
                flushParagraph();
                const quoteLines = [];
                while (index < lines.length) {
                    const quoteLine = lines[index].match(/^ {0,3}>[ \t]?(.*)$/);
                    if (!quoteLine) break;
                    quoteLines.push(quoteLine[1]);
                    index++;
                }
                output.push('<blockquote class="md-quote">' + quoteLines.map(inline).join('<br>') + '</blockquote>');
                continue;
            }

            // GFM pipe table: a row containing "|" immediately followed by a
            // separator row of dashes/colons.
            if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
                flushParagraph();
                const headerLine = line;
                const alignLine = lines[index + 1];
                index += 2;
                const bodyLines = [];
                while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
                    bodyLines.push(lines[index]);
                    index++;
                }
                output.push(tableHtml(headerLine, alignLine, bodyLines));
                continue;
            }

            if (parseListLine(line)) {
                flushParagraph();
                const listItems = [];
                while (index < lines.length) {
                    const listItem = parseListLine(lines[index]);
                    if (!listItem) break;
                    listItems.push(listItem);
                    index++;
                }
                output.push(listHtml(listItems));
                continue;
            }

            paragraph.push(line);
            index++;
        }
        flushParagraph();
        return output.join('\n');
    }

    global.renderChatMarkdown = renderChatMarkdown;
})(typeof window !== 'undefined' ? window : globalThis);
