/* HELP.JS — Help Center search, topic filter and contact details.
   Plain script (no dependencies). The page works without it; this adds search,
   topic filtering, deep-link opening and the configurable contact details. */

(function () {
    'use strict';

    /* ── Support details ──
       The official project email is the single support contact. */
    var HELP_CONFIG = {
        supportEmail: 'qcustudentplanner.team@gmail.com',
        supportHours: ''           // not published; leave empty
    };

    var EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

    function $(selector, root) { return (root || document).querySelector(selector); }
    function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

    /* ── Contact details ── */
    function setupDetails() {
        var emailOk = EMAIL_PATTERN.test(HELP_CONFIG.supportEmail);

        /* The address is shown as plain text; the button below it is the link. */
        $$('[data-help-email]').forEach(function (el) {
            if (emailOk) {
                /* Allow a line break after the "@" so a narrow screen never
                   leaves a single letter alone on the second line. */
                var parts = HELP_CONFIG.supportEmail.split('@');
                el.textContent = '';
                el.classList.remove('help-placeholder');
                el.appendChild(document.createTextNode(parts[0] + '@'));
                el.appendChild(document.createElement('wbr'));
                el.appendChild(document.createTextNode(parts[1]));
            } else {
                el.classList.add('help-placeholder');
            }
        });

        /* The "Email us" button (a working mailto: link). */
        $$('[data-help-email-link]').forEach(function (el) {
            if (emailOk) {
                el.href = 'mailto:' + HELP_CONFIG.supportEmail;
                el.hidden = false;
            } else {
                el.hidden = true;
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

    /* ── Email links ──
       A plain mailto: link opens the computer's default mail app. On many
       desktops that app is missing or is not Gmail, so the click seems to do
       nothing. Every student signs in with a Gmail address, so on desktop these
       links open a Gmail compose window in a new tab instead. Phones keep the
       mailto: link, which opens the Gmail or Mail app that is already installed. */
    function isMobileDevice() {
        if (navigator.userAgentData && navigator.userAgentData.mobile === true) return true;
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return true;
        // iPadOS reports itself as a Mac but has a touch screen.
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    }

    function gmailComposeUrl(address, subject) {
        return 'https://mail.google.com/mail/?view=cm&fs=1' +
            '&to=' + encodeURIComponent(address) +
            '&su=' + encodeURIComponent(subject);
    }

    function setupMailLinks() {
        if (isMobileDevice()) return;

        $$('a[href^="mailto:"]').forEach(function (link) {
            var address = link.getAttribute('href').slice(7).split('?')[0];
            if (!EMAIL_PATTERN.test(address)) return;

            var subject = link.closest('#faq-security-report')
                ? 'Security or privacy issue'
                : 'QCU Student Planner support';

            link.setAttribute('data-mailto', link.getAttribute('href'));
            link.href = gmailComposeUrl(address, subject);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
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
        setupMailLinks();
        setupSearch();
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();
