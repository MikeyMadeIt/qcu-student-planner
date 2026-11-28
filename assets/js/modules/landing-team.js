/* LANDING PAGE: team avatars. Add or fix GitHub usernames here (avatar = github.com/<username>.png). */
(function () {
  var TEAM = ['MikeyMadeIt', 'kyutipatotie', 'plazaadriankyle', 'R2B-prog', 'majelainereyes', 'posakal', 'NarratingLife', 'Mumbles', 'TeHatdog'];
  var list = document.getElementById('ltTeam');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Second copy makes the loop seamless; hidden from assistive tech and keyboard.
  var passes = reduce.matches ? 1 : 2;
  for (var pass = 0; pass < passes; pass++) TEAM.forEach(function (u) {
    var li = document.createElement('li');
    if (pass) li.setAttribute('aria-hidden', 'true');
    var a = document.createElement('a');
    a.className = 'lt-member'; a.href = 'https://github.com/' + encodeURIComponent(u);
    if (pass) a.tabIndex = -1;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    var img = document.createElement('img');
    img.className = 'lt-avatar'; img.width = 80; img.height = 80; img.decoding = 'async';
    img.alt = ''; if (!pass) img.fetchPriority = 'high'; img.src = 'https://github.com/' + encodeURIComponent(u) + '.png?size=160';
    img.addEventListener('error', function () {
      var f = document.createElement('span'); f.className = 'lt-avatar'; f.textContent = u.charAt(0).toUpperCase();
      img.replaceWith(f);
    });
    var n = document.createElement('span'); n.className = 'lt-name'; n.textContent = u;
    a.appendChild(img); a.appendChild(n); li.appendChild(a); list.appendChild(li);
  });
  var m = document.getElementById('ltMarquee');
  if (reduce.matches) return;

  // Auto-scroll; the strip is two identical copies so we wrap at the halfway point.
  var SPEED = 40;               // px per second
  var paused = false, last = 0, pos = 0;
  function half() { return list.scrollWidth / 2 + parseFloat(getComputedStyle(list).columnGap || 0) / 2; }
  function wrap() { var h = half(); if (m.scrollLeft >= h) m.scrollLeft -= h; else if (m.scrollLeft <= 0) m.scrollLeft += h; }
  function tick(t) {
    if (last && !paused) {
      // Browsers may round scrollLeft to whole pixels, so keep our own fractional position.
      if (Math.abs(m.scrollLeft - pos) > 2) pos = m.scrollLeft;   // the user scrolled: follow them
      pos += SPEED * (t - last) / 1000;
      var h = half(); if (pos >= h) pos -= h; else if (pos < 0) pos += h;
      m.scrollLeft = pos;
    }
    last = t; requestAnimationFrame(tick);
  }
  m.scrollLeft = 1; pos = 1;
  requestAnimationFrame(tick);

  // Pause only while dragging, touching, or when a link has keyboard focus.
  var resumeTimer;
  function hold() { clearTimeout(resumeTimer); paused = true; }
  function release(delay) { clearTimeout(resumeTimer); resumeTimer = setTimeout(function () { paused = false; pos = m.scrollLeft; }, delay); }
  m.addEventListener('focusin', hold);
  m.addEventListener('focusout', function () { release(300); });
  m.addEventListener('touchstart', hold, { passive: true });
  m.addEventListener('touchend', function () { release(600); }, { passive: true });
  m.addEventListener('touchcancel', function () { release(600); }, { passive: true });
  m.addEventListener('scroll', wrap, { passive: true });

  // Mouse drag (touch uses the browser's native swipe).
  var dragging = false, startX = 0, startLeft = 0, moved = 0;
  m.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true; moved = 0; startX = e.clientX; startLeft = m.scrollLeft; hold();
    m.setPointerCapture(e.pointerId);
  });
  m.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
    if (moved > 4) m.classList.add('is-dragging');
    m.scrollLeft = startLeft - dx; wrap();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false; m.classList.remove('is-dragging');
    if (m.hasPointerCapture(e.pointerId)) m.releasePointerCapture(e.pointerId);
    release(250);
  }
  m.addEventListener('pointerup', endDrag);
  m.addEventListener('pointercancel', endDrag);
  // A drag must not open the profile link it ended on.
  m.addEventListener('click', function (e) { if (moved > 4) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
})();
