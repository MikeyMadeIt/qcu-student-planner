# Accessibility
 
Student Planner is used by students, including students who use assistive
technology, to track assignments, notes, and schedules, and to use the AI
study tools (Quiz Maker, Flashcard Maker, Study Assistant) to prepare for
exams. A barrier in the app can mean missed deadlines or blocked access to
study materials, so accessibility is treated as a feature requirement, not
an afterthought.
 
This document covers what the project currently prioritizes, what we ask of
contributors, how to report a barrier you've run into, who owns this work,
what we've tested, and what we know is still broken. If you're reading this
because something didn't work for you, the "Reporting accessibility issues"
section below is the fastest way to get help.
 
## Priorities
 
We're working toward the checkpoints in **WCAG 2.1 Level AA** as our
aspirational target. This is a goal we are building toward, not a
conformance claim — we have not completed a formal accessibility
evaluation, and until we do, nothing in this document should be read as
certifying that the app meets that standard.
 
In the meantime, we prioritize, in roughly this order:
 
1. **Keyboard access** — every action available with a mouse (navigating
   the sidebar, opening the file dropzone on the AI tool pages, flipping
   flashcards, answering quiz questions, dismissing modals/toasts) should
   also be reachable and operable from a keyboard alone, with a visible
   focus indicator.
2. **Screen reader support** — meaningful labels, roles, and live-region
   announcements for dynamic content, such as quiz progress, flashcard
   state, generation loading/error states, and toast notifications.
3. **Content and language clarity** — plain, direct wording in labels,
   error messages, and empty states (for example, saved-item lists state
   plainly what they're for and what happens when they're empty).
4. **Resilience under user preferences** — respecting reduced-motion and
   high-contrast / dark-theme settings, and not relying on color alone to
   convey state (e.g., selected difficulty, correct/incorrect answers).
 
## Contributor expectations
 
If your change touches UI, please do the following before opening a pull
request:
 
- **Keyboard-test the change.** Tab through it; confirm focus order is
  logical, nothing traps focus, and every interactive element (buttons,
  dropzones, pills, sliders, flip cards) has a visible focus state and
  responds to Enter/Space as appropriate.
- **Check for a text alternative.** Icons used as the only label on a
  button (e.g., icon-only actions like delete or remove-attachment) need an
  `aria-label` or equivalent. Purely decorative icons should be
  `aria-hidden="true"`.
- **Preserve semantic structure.** Use real headings, lists, and form
  labels rather than styled `div`s; keep one logical heading level per
  page/section rather than skipping levels.
- **Announce dynamic changes.** Content that updates without a page
  reload (history lists, loading/error/empty states, quiz scoring, toast
  messages) should use `aria-live` or an equivalent pattern so screen
  reader users aren't left guessing.
- **Don't rely on color alone.** Pair color-coded state (selected pill,
  correct/incorrect answer, danger actions) with text, an icon, or another
  non-color cue.
- **Spot-check contrast.** Text and meaningful icons should meet at least
  a 4.5:1 contrast ratio against their background in both the light and
  dark themes.
 
We don't currently run an automated accessibility linter or CI check — if
you add one (e.g., axe-core, Pa11y, eslint-plugin-jsx-a11y), note it here
and wire it into CI so it's documented and enforced going forward. Until
then, please include in your pull request description:
 
- What you manually tested (keyboard-only pass, screen reader pass, zoom
  level, etc.) and on what browser/OS.
- Any known accessibility trade-off or follow-up the change leaves behind.
 
## Reporting accessibility issues
 
If something in the app is hard or impossible to use with a keyboard,
screen reader, magnification, or any other assistive technology, please
open an issue (or email **[email protected]** if you'd
rather not use GitHub). You never need to disclose a disability or explain
why you're using a particular tool to have a report taken seriously.
 
Helpful details, if you have them (all optional):
 
- What you were trying to do (e.g., "generate a quiz," "mark an assignment
  done," "open the sidebar on mobile").
- The page or URL where it happened.
- What happened vs. what you expected.
- Browser and operating system.
- Assistive technology and version, if any (e.g., NVDA 2024.1 + Firefox,
  VoiceOver + Safari, Dragon, switch access, screen magnifier).
- A screenshot, screen recording, or screen-reader output — helpful, but
  never required.
 
### Severity
 
When we triage a report, a maintainer assigns one of these levels. You
don't need to guess at a severity when reporting — just describe the
impact in your own words.
 
- **Blocking** — a core task (signing in, viewing assignments/schedule,
  generating or taking a quiz/flashcard set, saving notes) cannot be
  completed at all with the assistive technology or input method in use,
  and there's no workaround.
- **Serious** — the task can be completed, but only with significant extra
  effort, confusion, or an unintuitive workaround (e.g., a control is
  reachable but unlabeled, so its purpose has to be guessed).
- **Moderate** — a real but narrower barrier, such as an inconsistent
  focus order, a missing landmark, or a contrast issue on secondary text.
- **Minor** — a cosmetic or edge-case issue that doesn't block
  understanding or task completion.
 
### How we respond
 
- We'll acknowledge new accessibility reports within **5 business days**.
- Blocking issues are prioritized for the next release; we'll share a
  workaround in the meantime whenever one exists.
- Serious and moderate issues are scheduled based on effort and impact; we
  aim to at least comment with a plan or timeline within **2 weeks**.
- We'll let you know when a fix ships and are glad to have you confirm it
  resolved the barrier for you if you're willing.
 
These are the targets we aim to hold ourselves to, not contractual
guarantees — if a report goes quiet, feel free to follow up.
 
## Ownership and maintenance
 
Accessibility is currently owned by the project maintainers collectively;
there is no dedicated accessibility lead yet. Whoever reviews a
user-facing pull request is responsible for checking it against the
contributor expectations above before merging.
 
We intend to revisit this document, and do a pass over open accessibility
issues, at least once per quarter. If a dedicated accessibility owner or
team is named in the future, their contact information will replace this
section, and this paragraph will describe how that responsibility is
handed off.
 
## Supported environments
 
We develop and manually test against:
 
- **Browsers:** current versions of Chrome, Firefox, Safari, and Edge.
- **Platforms:** desktop (Windows, macOS, Linux) and mobile web (iOS
  Safari, Android Chrome). The app is also installable as a PWA.
- **Input methods:** mouse/trackpad, touch, and keyboard-only navigation.
 
We have **not yet completed formal testing** with dedicated screen readers
or other assistive technology (e.g., NVDA, JAWS, VoiceOver, TalkBack).
Until that testing is done, treat screen reader support as a priority we're
building toward rather than a verified, supported configuration. If you
test with one and hit (or don't hit) problems, please tell us — see
"Reporting accessibility issues" above.
 
## Known limitations
 
This list reflects what we currently know about, not a complete audit. If
you find something not listed here, please report it.
 
- **No formal accessibility evaluation has been performed.** We have not
  verified WCAG conformance at any level; the priorities above describe
  intent, not confirmed results.
- **Screen reader behavior on interactive widgets is untested**, including
  the flashcard flip interaction, the difficulty-pill selector, and the
  question-count slider on the AI Quiz Maker. These may not announce state
  changes correctly.
- **Drag-and-drop file upload** (the attachment dropzone on the AI tool
  pages) has a keyboard- and click-accessible fallback (Enter/Space opens
  the file picker), but has not been verified end-to-end with a screen
  reader.
- **Reduced-motion preferences** are not yet respected for transitions and
  animations (card flips, fade-ins, progress bars).
- **Color contrast** has not been audited line-by-line across both the
  light and dark themes; some secondary/faint text may fall short of
  4.5:1 in places.
 
No tracked-issue links are listed yet — once these (or newly reported
barriers) are filed as issues, we'll link them here.
 
## Feedback and improvements
 
This document itself can be wrong, outdated, or missing something. If you
have a suggestion for how to make it clearer, or for how we should
approach accessibility in the project more broadly, please open an issue
or start a discussion — the same channels listed under "Reporting
accessibility issues" work for this too. If you're reporting an actual
barrier you hit while using the app, please use the reporting process
above instead so it gets triaged correctly.
