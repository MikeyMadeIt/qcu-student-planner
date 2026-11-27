/* LEGAL & POLICIES: builds the table of contents from the page's own headings, so the
   links can never drift out of sync with the content, and highlights the section being read.
   Anchor offsets for the fixed header are handled in CSS (scroll-margin-top). */
(function () {
    'use strict';

    var content = document.getElementById('legalTop');
    if (!content) return;

    var sections = Array.prototype.slice.call(document.querySelectorAll('[data-lg-section]'));
    var mainList = document.getElementById('lgTocMain');
    var fullList = document.getElementById('lgTocFull');
    var railList = document.getElementById('lgRailList');
    var tocToggle = document.getElementById('lgTocToggle');
    if (!sections.length || !mainList || !fullList || !railList) return;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Read the section tree from the headings: h2 = section, h3 = subsection, h4 = nested.
    var tree = sections.map(function (sec, i) {
        var h2 = sec.querySelector('.lg-h2');
        var numEl = sec.querySelector('.lg-section-num');
        var items = Array.prototype.slice.call(sec.querySelectorAll('.lg-h3, .lg-h4')).map(function (h) {
            var num = h.querySelector('.lg-num');
            return {
                id: h.id,
                level: h.classList.contains('lg-h4') ? 4 : 3,
                num: num ? num.textContent : '',
                title: h.textContent.slice(num ? num.textContent.length : 0).trim()
            };
        });
        var numbered = !numEl.querySelector('i');
        return { id: sec.id, num: numbered ? String(i + 1) : '', title: h2.textContent.trim(), items: items, el: sec };
    });

    // Top card: the main sections, always visible.
    mainList.innerHTML = tree.map(function (s) {
        return '<li><a href="#' + s.id + '">' +
            (s.num ? '<span class="lg-toc-num">' + s.num + '</span>' : '<span class="lg-toc-num"><i class="icon-lucide-bookmark" aria-hidden="true"></i></span>') +
            '<span class="lg-toc-label">' + esc(s.title) + '</span></a></li>';
    }).join('');

    function subList(s) {
        if (!s.items.length) return '';
        return '<ul class="lg-toc-sub">' + s.items.map(function (it) {
            return '<li class="lg-toc-l' + it.level + '"><a href="#' + it.id + '"><span class="lg-toc-subnum">' + esc(it.num) + '</span>' + esc(it.title) + '</a></li>';
        }).join('') + '</ul>';
    }

    // Top card, expandable: every subsection.
    fullList.innerHTML = tree.map(function (s) {
        if (!s.items.length) return '';
        return '<div class="lg-toc-group"><a class="lg-toc-group-title" href="#' + s.id + '">' +
            (s.num ? s.num + '. ' : '') + esc(s.title) + '</a>' + subList(s) + '</div>';
    }).join('');

    // Keep disclosure state independent from anchor navigation. Only this
    // button can collapse the subsection list; selecting a link never hides it.
    if (tocToggle) {
        tocToggle.addEventListener('click', function () {
            var expanded = tocToggle.getAttribute('aria-expanded') !== 'true';
            tocToggle.setAttribute('aria-expanded', String(expanded));
            fullList.hidden = !expanded;
        });
    }

    // Desktop rail: keep subsection links available while highlighting the active section.
    railList.innerHTML = tree.map(function (s) {
        return '<div class="lg-rail-group" data-rail="' + s.id + '"><a class="lg-rail-link" href="#' + s.id + '">' +
            (s.num ? '<span class="lg-toc-num">' + s.num + '</span>' : '<span class="lg-toc-num"><i class="icon-lucide-bookmark" aria-hidden="true"></i></span>') +
            '<span class="lg-toc-label">' + esc(s.title) + '</span></a>' + subList(s) + '</div>';
    }).join('');

    // Highlight the section currently being read.
    function setActive(id) {
        var groups = railList.querySelectorAll('.lg-rail-group');
        Array.prototype.forEach.call(groups, function (g) {
            var on = g.getAttribute('data-rail') === id;
            g.classList.toggle('is-active', on);
            var link = g.querySelector('.lg-rail-link');
            if (on) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    }

    if ('IntersectionObserver' in window) {
        var visible = {};
        var header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shell-bar-height')) || 60;
        var rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        var topOffset = Math.round((getComputedStyle(document.documentElement).getPropertyValue('--shell-bar-height').indexOf('rem') > -1 ? header * rootFont : header) + 16);

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
            var current = null;
            for (var i = 0; i < tree.length; i++) {
                if (visible[tree[i].id]) { current = tree[i].id; break; }
            }
            if (current) setActive(current);
        }, { rootMargin: '-' + topOffset + 'px 0px -55% 0px', threshold: 0 });

        sections.forEach(function (sec) { observer.observe(sec); });
    }
    setActive(tree[0].id);
})();
