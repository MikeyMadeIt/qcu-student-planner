/* ============================================================
   TIME-FIELD.JS — shared typed + dropdown time input
   Uses the .sch-time-* styles. Stores "HH:MM" in a hidden input
   whose id is the id you pass to TimeField.html().
   ============================================================ */
(function () {
    'use strict';

    var MENU_FIRST = 5 * 60;        // 5:00 AM
    var MENU_LAST = 23 * 60 + 45;   // 11:45 PM
    var STEP = 15;
    var ORDER_MSG = 'End time must be later than start time';
    var globalBound = false;

    function esc(s) {
        if (typeof escHtml === 'function') return escHtml(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function toMins(v) {
        var m = /^(\d{2}):(\d{2})/.exec(v || '');
        return m ? (+m[1]) * 60 + (+m[2]) : null;
    }

    function fromMins(m) {
        var h = Math.floor(m / 60), mm = m % 60;
        return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
    }

    function fmt12(v) {
        var mins = toMins(v);
        if (mins == null) return '';
        var h = Math.floor(mins / 60), mi = mins % 60;
        return (h % 12 || 12) + ':' + (mi < 10 ? '0' : '') + mi + ' ' + (h >= 12 ? 'PM' : 'AM');
    }

    function fmtLen(mins) {
        var h = Math.floor(mins / 60), m = mins % 60;
        return [h ? h + ' hr' : '', m ? m + ' min' : ''].filter(Boolean).join(' ');
    }

    /* Returns { empty } | { error } | { value:'HH:MM', assumed:boolean } */
    function parse(raw, afterMins) {
        var s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, ' ');
        if (!s) return { empty: true };
        if (s === 'noon') return { value: '12:00' };
        var unreadable = { error: "Couldn't read that time. Try 9:30 AM or 14:30, or pick from the list." };
        var mer = null;
        var mm = s.match(/\s*([ap])\.?\s*m?\.?\s*$/);
        if (mm) {
            mer = mm[1] === 'a' ? 'am' : 'pm';
            s = s.slice(0, mm.index).trim();
        }
        var hStr, miStr, m;
        if ((m = s.match(/^(\d{1,2})\s*[:.h]\s*(\d{2})$/)) || (m = s.match(/^(\d{1,2})\s+(\d{2})$/))) {
            hStr = m[1]; miStr = m[2];
        } else if ((m = s.match(/^(\d{3,4})$/))) {
            hStr = m[1].slice(0, -2); miStr = m[1].slice(-2);
        } else if ((m = s.match(/^(\d{1,2})$/))) {
            hStr = m[1]; miStr = '00';
        } else return unreadable;

        var h = +hStr, mi = +miStr;
        if (mi > 59) return { error: 'Minutes must be between 00 and 59. Or pick from the list.' };
        var assumed = false;
        if (mer) {
            if (h >= 13 && h <= 23) { /* 24-hour hour with stray am/pm: trust the hour */ }
            else if (h < 1 || h > 12) return { error: 'With AM/PM, use an hour from 1 to 12.' };
            else if (mer === 'am') h = h === 12 ? 0 : h;
            else h = h === 12 ? 12 : h + 12;
        } else {
            if (h > 23) return { error: 'Hours go from 0 to 23 (or 1 to 12 with AM/PM).' };
            var explicit24 = h === 0 || h >= 13 || (hStr.length === 2 && hStr[0] === '0');
            if (!explicit24) {
                assumed = true;
                if (h >= 1 && h <= 6) h += 12; // 7-11 stay AM, 12 noon, 1-6 -> PM
            }
        }
        var mins = h * 60 + mi;
        if (assumed && afterMins != null && mins <= afterMins && mins + 720 > afterMins && mins + 720 < 1440) mins += 720;
        return { value: fromMins(mins), assumed: assumed };
    }

    /* o: { id, label, value, placeholder, required, after (id of the Start field), fallback ('HH:MM') } */
    function html(o) {
        var id = o.id;
        var v = toMins(o.value) != null ? String(o.value).slice(0, 5) : '';
        return '<div class="sch-time-col">' +
        '<label' + (o.labelClass ? ' class="' + o.labelClass + '"' : '') + ' for="' + id + 'Text">' + esc(o.label) +
            (o.required ? ' <span class="sch-subject-required" aria-hidden="true">*</span>' : '') + '</label>' +
            '<div class="sch-time-field" data-time-key="' + (o.after ? 'End' : 'Start') + '" data-tf="' + id + '" data-label="' + esc(o.label) + '"' +
            (o.after ? ' data-after="' + o.after + '"' : '') +
            (o.fallback ? ' data-fallback="' + o.fallback + '"' : '') +
            (o.required ? ' data-required="1"' : '') + '>' +
            '<input type="text" class="form-control sch-time-input" id="' + id + 'Text" value="' + (v ? fmt12(v) : '') + '" placeholder="' + esc(o.placeholder || '') + '" ' +
            'inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" role="combobox" aria-autocomplete="list" ' +
            'aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + 'Menu" aria-invalid="false" aria-describedby="' + id + 'Error">' +
            '<button type="button" class="sch-time-btn" id="' + id + 'Btn" aria-label="Pick ' + esc(String(o.label).toLowerCase()) + ' from list" aria-haspopup="listbox"><i class="bi bi-clock" aria-hidden="true"></i></button>' +
            '<input type="hidden" id="' + id + '" value="' + v + '">' +
            '<div class="sch-time-menu" id="' + id + 'Menu" role="listbox" aria-label="' + esc(o.label) + ' options" hidden></div>' +
            '</div><p class="sch-subject-error" id="' + id + 'Error" hidden></p>' +
            '<p class="sch-time-hint" id="' + id + 'Note" data-note-for="' + id + '" hidden></p></div>';
    }

    function notesFor(ids) {
    var out = [];
    ids.forEach(function (id) {
        var f = document.querySelector('.sch-time-field[data-tf="' + id + '"]');
        var h = document.getElementById(id);
        if (f && f.dataset.assumed === '1' && h && h.value)
            out.push(f.dataset.label + ' read as ' + fmt12(h.value) + '. Add "am" or "pm" to change.');
    });
    return out;
}

    function refreshHints() {
        var paired = {};
        document.querySelectorAll('.sch-time-hint[data-start][data-end]').forEach(function (h) {
            paired[h.dataset.start] = paired[h.dataset.end] = 1;
            var s = document.getElementById(h.dataset.start), e = document.getElementById(h.dataset.end);
            var sm = s ? toMins(s.value) : null, em = e ? toMins(e.value) : null;
            var parts = [];
            if (sm != null && em != null && em > sm)
                parts.push('<i class="bi bi-hourglass-split" aria-hidden="true"></i> ' + fmtLen(em - sm));
            var notes = notesFor([h.dataset.start, h.dataset.end]);
            if (notes.length) parts.push(notes.join(' '));
            h.innerHTML = parts.length ? parts.join(' · ') : 'Type a time (9:30 AM, 930, 14:30) or tap the clock to pick.';
        });
        document.querySelectorAll('.sch-time-hint[data-note-for]').forEach(function (n) {
            var notes = paired[n.dataset.noteFor] ? [] : notesFor([n.dataset.noteFor]);
            n.textContent = notes.join(' ');
            n.hidden = !notes.length;
        });
    }

    function closeAll(exceptId) {
        document.querySelectorAll('.sch-time-field[data-tf]').forEach(function (f) {
            if (f.dataset.tf !== exceptId && f._tfClose) f._tfClose();
        });
    }

    function initField(field) {
        var id = field.dataset.tf;
        var text = document.getElementById(id + 'Text');
        var hidden = document.getElementById(id);
        var btn = document.getElementById(id + 'Btn');
        var menu = document.getElementById(id + 'Menu');
        var err = document.getElementById(id + 'Error');
        var afterId = field.dataset.after || '';
        var fallback = field.dataset.fallback || '';
        var required = field.dataset.required === '1';
        var label = field.dataset.label || 'Time';
        var attempted = false, active = null, navigated = false;

        function afterMins() {
            var a = afterId && document.getElementById(afterId);
            return a ? toMins(a.value) : null;
        }

        function setError(msg) {
            err.textContent = msg || '';
            err.hidden = !msg;
            text.setAttribute('aria-invalid', msg ? 'true' : 'false');
            field.classList.toggle('has-error', !!msg);
        }

        function checkOrder() {
            if (!afterId) return;
            var s = afterMins(), e = toMins(hidden.value);
            if (s != null && e != null) setError(e <= s ? ORDER_MSG : '');
            else if (err.textContent === ORDER_MSG) setError('');
        }

        function notifyDependents() {
            var dep = document.querySelector('.sch-time-field[data-after="' + id + '"]');
            if (dep && dep._tfCheckOrder) dep._tfCheckOrder();
            refreshHints();
        }

        function commit() {
            field.dataset.assumed = '0';
            var raw = text.value;
            if (!raw.trim()) {
                if (fallback) {
                    hidden.value = fallback;
                    text.value = fmt12(fallback);
                    setError('');
                } else {
                    hidden.value = '';
                    setError(attempted && required ? label + ' is required' : '');
                }
            } else {
                var r = parse(raw, afterMins());
                if (r.error) {
                    hidden.value = '';
                    setError(r.error);
                } else {
                    hidden.value = r.value;
                    text.value = fmt12(r.value);
                    field.dataset.assumed = r.assumed ? '1' : '0';
                    setError('');
                }
            }
            checkOrder();
            notifyDependents();
        }

        function setValue(v) {
            field.dataset.assumed = '0';
            hidden.value = v;
            text.value = fmt12(v);
            setError('');
            checkOrder();
            notifyDependents();
        }

        function setActive(opt, center) {
            if (active) active.classList.remove('is-active');
            active = opt;
            if (!opt) { text.removeAttribute('aria-activedescendant'); return; }
            opt.classList.add('is-active');
            text.setAttribute('aria-activedescendant', opt.id);
            var top = opt.offsetTop, h = menu.clientHeight;
            if (center) menu.scrollTop = top - h / 2 + opt.offsetHeight / 2;
            else if (top < menu.scrollTop) menu.scrollTop = top;
            else if (top + opt.offsetHeight > menu.scrollTop + h) menu.scrollTop = top + opt.offsetHeight - h;
        }

        function open() {
            closeAll(id);
            if (!menu.hidden) return;
            var curMins = toMins(hidden.value), startMins = afterMins(), fbMins = toMins(fallback);
            var first = startMins != null ? (Math.floor(startMins / STEP) + 1) * STEP : MENU_FIRST;
            var times = [];
            for (var m = first; m <= MENU_LAST; m += STEP) times.push(m);
            [curMins, fbMins].forEach(function (x) {
                if (x != null && times.indexOf(x) < 0 && (startMins == null || x > startMins)) times.push(x);
            });
            times.sort(function (a, b) { return a - b; });
            if (!times.length) return;

            menu.innerHTML = times.map(function (m) {
                var v = fromMins(m);
                var dur = startMins != null ? '<span class="sch-time-opt-dur">' + fmtLen(m - startMins) + '</span>' : '';
                return '<div class="sch-time-opt" role="option" id="' + id + 'Opt-' + v.replace(':', '') + '" data-value="' + v + '" aria-selected="' + (v === hidden.value) + '">' + fmt12(v) + dur + '</div>';
            }).join('');
            menu.hidden = false;
            text.setAttribute('aria-expanded', 'true');
            navigated = false;

            // Open upward when there isn't room below
            menu.classList.remove('is-up');
            var fr = field.getBoundingClientRect();
            var br = (field.closest('.modal-body') || document.body).getBoundingClientRect();
            var below = Math.min(br.bottom, window.innerHeight) - fr.bottom;
            var above = fr.top - Math.max(br.top, 0);
            menu.classList.toggle('is-up', below < 240 && above > below);

            var target = (curMins != null && times.indexOf(curMins) >= 0) ? curMins
                : (startMins != null ? startMins + 90 : (fbMins != null ? fbMins : 8 * 60));
            var nearest = times.reduce(function (b, m) { return Math.abs(m - target) < Math.abs(b - target) ? m : b; }, times[0]);
            setActive(menu.querySelector('[data-value="' + fromMins(nearest) + '"]'), true);
        }

        function close() {
            menu.hidden = true;
            text.setAttribute('aria-expanded', 'false');
            text.removeAttribute('aria-activedescendant');
            active = null;
        }

        field._tfClose = close;
        field._tfCheckOrder = checkOrder;
        field._tfAttempt = function () { attempted = true; commit(); };

        text.addEventListener('focus', function () { setTimeout(function () { text.select(); }, 0); });
        text.addEventListener('input', function () {
            setError('');
            navigated = false;
            if (!menu.hidden) { // keep the list in step with what's typed
                var r = parse(text.value, afterMins());
                var opt = r.value && menu.querySelector('[data-value="' + r.value + '"]');
                if (opt) setActive(opt, true);
            }
        });
        text.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (menu.hidden) { commit(); open(); return; }
                var opts = Array.prototype.slice.call(menu.querySelectorAll('.sch-time-opt'));
                var idx = opts.indexOf(active);
                var next = Math.max(0, Math.min(opts.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
                navigated = true;
                setActive(opts[next], false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!menu.hidden && navigated && active) setValue(active.dataset.value);
                else commit();
                close();
                if (window.matchMedia('(hover: none)').matches) text.blur(); // dismiss on-screen keyboard
            } else if (e.key === 'Escape' && !menu.hidden) {
                e.stopPropagation(); // close the list, not the whole modal
                close();
            }
        });
        field.addEventListener('focusout', function (e) {
            if (!field.contains(e.relatedTarget)) { commit(); close(); }
        });
        btn.addEventListener('click', function () {
            if (!menu.hidden) { close(); return; }
            commit();
            open();
        });
        menu.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus put
        menu.addEventListener('click', function (e) {
            var opt = e.target.closest('.sch-time-opt');
            if (!opt) return;
            setValue(opt.dataset.value);
            close();
        });
    }

    function init(root) {
        (root || document).querySelectorAll('.sch-time-field[data-tf]').forEach(initField);
        refreshHints();
        if (!globalBound) {
            globalBound = true;
            document.addEventListener('pointerdown', function (e) {
                if (!e.target.closest('.sch-time-field')) closeAll();
            });
        }
    }

    /* Commits each field, shows errors, focuses the first bad one. Returns true when all are valid. */
    function validate(ids) {
        var firstBad = null;
        ids.forEach(function (id) {
            var f = document.querySelector('.sch-time-field[data-tf="' + id + '"]');
            if (!f || !f._tfAttempt) return;
            f._tfAttempt();
            var h = document.getElementById(id), er = document.getElementById(id + 'Error');
            var bad = (f.dataset.required === '1' && !h.value) || !er.hidden;
            if (bad && !firstBad) firstBad = id;
        });
        if (firstBad) {
            var t = document.getElementById(firstBad + 'Text');
            if (t) t.focus();
            return false;
        }
        return true;
    }

    window.TimeField = {
        html: html,
        init: init,
        validate: validate,
        get: function (id) { var h = document.getElementById(id); return h ? h.value : ''; },
        format: fmt12
    };
})();