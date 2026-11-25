## D1. Keeping a student's semester information together
struggled with: Initially described the features and their connections, then needed help reasoning through the consequences of deleting a subject.
found on their own: Curriculum subjects can be imported into a student's subject setup; dashboard summaries update from shared database records; archiving preserves linked tasks and other history.
did well: Connected subject changes to the summary without hardcoding and recognized archive as a way to retain related records.
did ok: Was unsure whether deletion should leave linked data or remove it too; considered the data integrity tradeoff with options.

## D2. Preserving a student's work across visits and devices
struggled with: Initially focused on ending the login session and an error page for lost connections; needed a prompt to consider unsaved changes and competing edits across devices.
found on their own: Unsaved work should wait and sync to the database after connectivity returns; chose last-sync-wins for conflicts and accepted its overwrite tradeoff.
did well: Separated ending access from retaining planner data and recognized offline edits need to survive until synchronization.
did ok: Needed options to choose a conflict rule; agreed the rule means the last update to reach the database wins, even if it was made earlier.

## D3. Deciding who may use student records
struggled with: Thought the browser page guard and login redirect were sufficient to prevent unauthorized data access; a request-path sketch exposed that database requests do not pass through page navigation.
found on their own: Students should only access their own records through row-level policies; new Google-authenticated accounts need manual approval.
did well: Started with the right ingredients—Google sign-in, manual approval and row-level policies—and selected database-enforced approval and ownership after seeing the bypass path.
did ok: Needed a diagram and tradeoff options to distinguish page access checks from database authorization.

## D4. Sharing university dates without giving every student edit rights
struggled with: None; reached the intended boundary directly.
found on their own: Admins maintain university dates from the yearly official calendar; students see those dates alongside their personal calendar entries in read-only form.
did well: Kept shared university information centrally managed while preserving student control of personal dates.
did ok: No major gaps surfaced in this problem.

## D5. Performing administrative actions with a trustworthy audit trail
struggled with: Initially focused on role-gated admin pages and a single known admin; needed prompts to distinguish current status from a reconstructable history and to consider partial failure between a change and its record.
found on their own: Chose a protected operation that records each change and actor, then chose one database operation so the status change and history record succeed or fail together.
did well: Recognized database-protected roles and selected a traceable, tamper-resistant path for administrative actions.
did ok: Needed options to reach the history mechanism and atomicity requirement.

## D6. Estimating academic progress from incomplete records
struggled with: Initially did not know how to decide completion and first preferred manual statuses; after considering the workload, chose a combined approach from the tradeoff options.
found on their own: Selected using existing evidence while allowing students to correct statuses; described duplicate prevention when importing a curriculum course and conflict feedback when adding a duplicate through subject setup.
did well: Balanced automation with student correction and agreed that retakes should not inflate the curriculum requirement count while remaining in grade history.
did ok: Needed options to find the combined inference approach and a prompt to consider repeated course codes.

## D7. Making many planner tools usable across screen sizes
struggled with: Initially described only the mobile header menu and desktop sidebar; needed prompts to identify the active destination and keyboard focus behavior.
found on their own: Use the page title and highlight the active tab; chose moving focus into the menu and returning it to the menu button when closed, including Escape dismissal.
did well: Preserved consistent destinations while adapting the layout to each screen size, then accounted for keyboard users.
did ok: Needed options to settle the focus-management behavior.

## D8. Providing AI study features through a controlled service boundary
struggled with: Reached the Edge Function boundary directly, then needed prompts to set prompt/file limits and handle growing conversation context.
found on their own: Set an 8 MB attachment limit for PNG, JPG and PDF; chose a clear unavailable message; proposed a summary of older conversation plus recent turns, with the assistant asking students to repeat missing details.
did well: Kept requests bounded while considering continuity and student-facing failures.
did ok: Needed options to resolve uncertainty about long-term context and how to correct missing details.
better idea: An editable summary plus recent turns gives students more control than dropping older messages; it adds summary maintenance.

## D9. Turning assessment records into comparable grade summaries
struggled with: Initially did not know the calculation approach; selected a provisional weighted estimate after comparing options.
found on their own: Chose to use the same calculation in the Grades page and dashboard, keep the university's grade scale, and show a warning while weights are incomplete.
did well: Kept the interim estimate useful while signaling that the grading setup is unfinished.
did ok: Needed options to choose how missing components affect the current grade.

## D10. Firing reminders from planner data without duplicate alerts
struggled with: Initially chose server scheduling, which would be better for alerts while closed but is unavailable in the current setup; then needed prompts to move checks into the open app and handle repeated firing.
found on their own: Chose periodic checks while the planner is open, a stable identity plus saved sent state, and pruning old reminder records after a short period.
did well: Considered both delivery timing and deduplication across repeated checks/reloads.
did ok: Needed options to reach periodic checks and the bounded deduplication history; accepted the limitation that reminders stop when the app is closed.
