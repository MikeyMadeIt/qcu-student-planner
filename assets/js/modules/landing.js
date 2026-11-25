/* LANDING PAGE: mobile menu behaviour. Everything else on the page is plain HTML and CSS. */
(function () {
    'use strict';

    var header = document.getElementById('lpHeader');
    var btn = document.getElementById('lpMenuBtn');
    var nav = document.getElementById('lpNav');
    if (!header || !btn || !nav) return;

    var desktop = window.matchMedia('(min-width: 900px)');

    function setOpen(open) {
        header.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        var icon = btn.querySelector('.lucide-icon, i[class*="icon-lucide-"]');
        if (icon) window.setLucideIcon(icon, open ? 'x' : 'list');
    }

    btn.addEventListener('click', function () {
        setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });

    // Choosing a link closes the menu so the section is in view.
    nav.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            btn.focus();
        }
    });

    // Tapping outside the open menu closes it.
    document.addEventListener('click', function (e) {
        if (btn.getAttribute('aria-expanded') === 'true' && !header.contains(e.target)) setOpen(false);
    });

    function onResize() { if (desktop.matches) setOpen(false); }
    if (desktop.addEventListener) desktop.addEventListener('change', onResize);
    else if (desktop.addListener) desktop.addListener(onResize);
})();
