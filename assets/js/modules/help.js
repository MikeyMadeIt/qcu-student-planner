/* HELP.JS — Help Center search, topic filter and contact placeholders.
   Plain script (no dependencies). The page works without it; this adds search,
   topic filtering, deep-link opening and the configurable contact details. */

(function () {
    'use strict';

    /* ── Configurable support details ──
       Leave a value empty until it is confirmed. Empty values show a clearly
       marked placeholder instead of an invented contact. */
    var HELP_CONFIG = {
        supportEmail: '',          // e.g. 'support@example.com' once a temporary address exists
        supportHours: ''           // e.g. 'Mon-Fri, 9 AM-5 PM' once confirmed
    };

    var EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

    function $(selector, root) { return (root || document).querySelector(selector); }
    function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

    /* ── Contact details ── */
    function setupDetails() {
        var emailOk = EMAIL_PATTERN.test(HELP_CONFIG.supportEmail);
        $$('[data-help-email]').forEach(function (el) {
            if (emailOk) {
                var link = document.createElement('a');
                link.href = 'mailto:' + HELP_CONFIG.supportEmail;
                link.textContent = HELP_CONFIG.supportEmail;
                el.textContent = '';
                el.classList.remove('help-placeholder');
                el.appendChild(link);
            } else {
                el.classList.add('help-placeholder');
            }
        });
        $$('[data-help-hours]').forEach(function (el) {
            if (HELP_CONFIG.supportHours) {
                el.textContent = HELP_CONFIG.supportHours;
                el.classList.remove('help-placeholder');
            } else {
                el.classList.add('help-placeholder');
            }
        });
    }

    /* ── Search + topic filter ── */
    var input, clearBtn, status, emptyState, pills;
    var items = [];
    var activeTopic = 'all';

    function normalize(text) {
        return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function indexItems() {
        items = $$('[data-help-item]').map(function (el) {
            return {
                el: el,
                text: normalize(el.textContent + ' ' + (el.getAttribute('data-keywords') || ''))
            };
        });
    }

    function setTopic(topic) {
        activeTopic = topic;
        pills.forEach(function (pill) {
            var on = pill.getAttribute('data-filter') === topic;
            pill.classList.toggle('is-active', on);
            pill.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function runSearch() {
        var query = normalize(input.value);
        var terms = query ? query.split(' ') : [];
        var searching = terms.length > 0;

        clearBtn.hidden = !input.value;
        if (searching && activeTopic !== 'all')
            setTopic('all');

        var matches = 0;
        items.forEach(function (item) {
            var ok = !searching || terms.every(function (term) { return item.text.indexOf(term) !== -1; });
            item.el.hidden = !ok;
            if (ok) matches++;
            if (item.el.tagName === 'DETAILS') {
                if (searching && ok && !item.el.open) {
                    item.el.open = true;
                    item.el.setAttribute('data-opened-by-search', '1');
                } else if ((!searching || !ok) && item.el.getAttribute('data-opened-by-search')) {
                    item.el.open = false;
                    item.el.removeAttribute('data-opened-by-search');
                }
            }
        });

        // Keep long result lists collapsed so the page stays readable.
        if (searching && matches > 6) {
            items.forEach(function (item) {
                if (item.el.getAttribute('data-opened-by-search')) {
                    item.el.open = false;
                    item.el.removeAttribute('data-opened-by-search');
                }
            });
        }

        // Topic groups: show only the chosen topic, and hide groups with no matches.
        $$('.help-cat').forEach(function (cat) {
            var inTopic = activeTopic === 'all' || cat.getAttribute('data-cat') === activeTopic;
            var visible = $$('[data-help-item]', cat).some(function (el) { return !el.hidden; });
            cat.hidden = !inTopic || !visible;
        });

        // Whole sections with nothing left to show.
        $$('[data-help-section][data-searchable]').forEach(function (section) {
            var visible = $$('[data-help-item]', section).some(function (el) { return !el.hidden; });
            section.hidden = !visible;
        });

        $('#helpChips').hidden = searching;
        $('#helpPills').hidden = searching;

        if (searching) {
            status.hidden = false;
            status.textContent = matches === 1 ? '1 result' : matches + ' results';
        } else {
            status.hidden = true;
            status.textContent = '';
        }
        emptyState.hidden = !(searching && matches === 0);
    }

    function clearSearch(keepFocus) {
        input.value = '';
        runSearch();
        if (keepFocus !== false) input.focus();
    }

    function setupSearch() {
        input = $('#helpSearch');
        clearBtn = $('#helpSearchClear');
        status = $('#helpSearchStatus');
        emptyState = $('#helpEmpty');
        pills = $$('.help-pill');
        if (!input) return;

        indexItems();
        input.addEventListener('input', runSearch);
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && input.value) {
                event.preventDefault();
                clearSearch();
            }
        });
        clearBtn.addEventListener('click', function () { clearSearch(); });
        var emptyClear = $('#helpEmptyClear');
        if (emptyClear) emptyClear.addEventListener('click', function () { clearSearch(); });

        pills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                setTopic(pill.getAttribute('data-filter'));
                runSearch();
            });
        });
    }

    /* ── Deep links: open the question or guide a link points to ── */
    function openFromHash() {
        var raw = (location.hash || '').slice(1);
        if (!raw) return;
        var id;
        try {
            id = decodeURIComponent(raw);
        } catch (e) {
            return; // malformed link such as "#%"
        }
        var target = document.getElementById(id);
        if (!target) return;

        // If the search or topic filter is hiding the target, reset them so it shows.
        if (input && (target.hidden || target.closest('[hidden]'))) {
            if (input.value) clearSearch(false);
            setTopic('all');
            runSearch();
        }

        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ block: 'start' });
    }

    function init() {
        setupDetails();
        setupSearch();
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();