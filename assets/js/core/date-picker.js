/* Shared Swiss-style date picker. Keeps the original date input and ISO value as the form contract. */
(function () {
    'use strict';
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
    function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; var d = new Date(+m[1], +m[2]-1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2]-1 && d.getDate() === +m[3] ? d : null; }
    var compactMobile = window.matchMedia ? window.matchMedia('(max-width: 575.98px)') : null;
    function label(v, input) {
        var d = parse(v);
        if (!d) return 'Select date';
        if (input && input.dataset.compactMobile === 'true' && compactMobile && compactMobile.matches)
            return d.toLocaleDateString('en-US', {year:'2-digit', month:'numeric', day:'numeric'});
        return d.toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'});
    }
    function init(input) {
        if (input.dataset.datePickerReady || input.type !== 'date') return;
        input.dataset.datePickerReady = '1';
        var wrap = document.createElement('div'); wrap.className = 'date-picker-field';
        input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
        var button = document.createElement('button'); button.type = 'button'; button.id = input.id ? input.id + 'Picker' : ''; button.className = 'date-picker-trigger form-control' + (input.classList.contains('form-control-sm') ? ' form-control-sm' : '');
        button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-expanded','false'); button.setAttribute('aria-label', input.getAttribute('aria-label') || 'Choose date');
        input.tabIndex = -1; input.setAttribute('aria-hidden','true');
        if (input.id) document.querySelectorAll('label[for]').forEach(function(l){if(l.htmlFor===input.id)l.htmlFor=button.id;});
        var text = document.createElement('span'); text.className = 'date-picker-value';
        function syncText() { text.textContent = label(input.value, input); }
        syncText();
        if (compactMobile && input.dataset.compactMobile === 'true') {
            var syncOnBreakpoint = function () { syncText(); };
            if (compactMobile.addEventListener) compactMobile.addEventListener('change', syncOnBreakpoint);
            else if (compactMobile.addListener) compactMobile.addListener(syncOnBreakpoint);
        }
        var icon = document.createElement('i'); icon.className = 'icon-lucide-calendar-days'; icon.setAttribute('aria-hidden','true'); button.append(text, icon); wrap.appendChild(button);
        var panel = document.createElement('div'); panel.id = button.id ? button.id + 'Panel' : ''; panel.className = 'date-picker-panel'; panel.hidden = true; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Choose date');
        button.setAttribute('aria-controls',panel.id); document.body.appendChild(panel);
        var viewDate = parse(input.value) || new Date();
        var reposition = function () {
            if (panel.hidden) return;
            var r=button.getBoundingClientRect(), pr=panel.getBoundingClientRect(), gap=8;
            var left=Math.max(gap,Math.min(r.left,window.innerWidth-pr.width-gap));
            var below=window.innerHeight-r.bottom-gap, top=below>=pr.height+6?r.bottom+6:r.top-pr.height-6;
            top=Math.max(gap,Math.min(top,window.innerHeight-pr.height-gap));
            panel.style.left=left+'px'; panel.style.top=top+'px';
        };
        function stopPositioning() { window.removeEventListener('resize',reposition); window.removeEventListener('scroll',reposition,true); }
        function render(view) {
            var y=view.getFullYear(), m=view.getMonth(), first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate(), selected=parse(input.value), today=new Date(); today.setHours(0,0,0,0);
            panel.innerHTML = '<div class="dp-head"><button type="button" data-shift="-1" aria-label="Previous month">‹</button><strong>'+months[m]+' '+y+'</strong><button type="button" data-shift="1" aria-label="Next month">›</button></div><div class="dp-grid dp-week" aria-hidden="true">'+['Mo','Tu','We','Th','Fr','Sa','Su'].map(function(x){return '<span>'+x+'</span>';}).join('')+'</div><div class="dp-grid">';
            for (var i=0;i<start;i++) panel.lastChild.insertAdjacentHTML('beforeend','<span class="dp-empty"></span>');
            for (var n=1;n<=days;n++) { var d=new Date(y,m,n), v=iso(d), disabled=(input.min && v<input.min)||(input.max && v>input.max); panel.lastChild.insertAdjacentHTML('beforeend','<button type="button" class="dp-day'+(selected&&iso(selected)===v?' is-selected':'')+(iso(today)===v?' is-today':'')+'" data-date="'+v+'"'+(disabled?' disabled':'')+' aria-pressed="'+(selected&&iso(selected)===v)+'" aria-label="'+d.toLocaleDateString(undefined,{dateStyle:'full'})+'">'+n+'</button>'); }
        }
        function open() { document.querySelectorAll('.date-picker-panel:not([hidden])').forEach(function(p){if(p!==panel&&p._datePickerClose)p._datePickerClose();}); viewDate=parse(input.value)||new Date(); render(viewDate); panel.hidden=false; button.setAttribute('aria-expanded','true'); reposition(); window.addEventListener('resize',reposition); window.addEventListener('scroll',reposition,true); }
        function close() { panel.hidden=true; button.setAttribute('aria-expanded','false'); stopPositioning(); }
        panel._datePickerClose=close;
        button.addEventListener('click',function(){panel.hidden?open():close();});
        panel.addEventListener('click',function(e){ var shift=e.target.closest('[data-shift]'); if(shift){viewDate.setDate(1); viewDate.setMonth(viewDate.getMonth()+Number(shift.dataset.shift)); render(viewDate); reposition(); return;} var day=e.target.closest('[data-date]'); if(day&&!day.disabled){input.value=day.dataset.date; syncText(); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); close(); button.focus();} });
        input.addEventListener('change',syncText);
        input.addEventListener('dp-sync',syncText);
        if (input.form) input.form.addEventListener('reset',function(){setTimeout(syncText,0);});
        button.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){e.preventDefault();open(); var first=panel.querySelector('[data-date]:not(:disabled)'); if(first)first.focus();}});
        panel.addEventListener('keydown',function(e){if(e.key==='Escape'){close();button.focus();} else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var all=[].slice.call(panel.querySelectorAll('[data-date]:not(:disabled)')), i=all.indexOf(document.activeElement); if(i>=0){e.preventDefault();all[Math.max(0,Math.min(all.length-1,i+(e.key==='ArrowRight'?1:-1)))].focus();}}});
        if (window.MutationObserver) new MutationObserver(syncText).observe(input,{attributes:true,attributeFilter:['value','min','max']});
    }
    function scan(root){(root||document).querySelectorAll('input[type="date"]').forEach(init);}
    document.addEventListener('pointerdown',function(e){if(!e.target.closest('.date-picker-field,.date-picker-panel'))document.querySelectorAll('.date-picker-panel:not([hidden])').forEach(function(p){if(p._datePickerClose)p._datePickerClose();});});
    document.addEventListener('DOMContentLoaded',function(){scan(); if(window.MutationObserver)new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.matches&&n.matches('input[type="date"]'))init(n);scan(n);}});});}).observe(document.body,{childList:true,subtree:true});});
    window.DatePicker={init:scan,refresh:function(id){var el=document.getElementById(id);if(el)el.dispatchEvent(new Event('dp-sync'));}};
})();
