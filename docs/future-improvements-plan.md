# Future Improvements Plan

This file tracks the next planned work after the sync, backup/export, lint, and Data Health checkpoint.

## Guiding Rules

- Keep risky maintenance logic changes in their own checkpoints.
- Do not push without explicit confirmation.
- Prefer read-only/diagnostic UI before adding destructive or syncing behavior.
- After each meaningful batch, run lint and build before deciding whether to continue.

## Phase 1: Maintenance Forecast And Reminder Improvements

Risk: High  
Priority: Highest

- [x] Audit current dashboard due-soon logic, maintenance overview status logic, and notification settings.
- [x] Make due-soon and overdue checks consistently use active `maintenanceEntries`.
- [x] Base reminder status on:
  - latest maintenance entry per category
  - current odometer
  - interval km
  - safety margin km
  - enabled/disabled category setting
- [x] Improve estimated due date using the all-entry average daily distance calculation.
- [x] Show clear states in maintenance item details:
  - notifications off
  - watching
  - due soon
  - overdue
- [x] Ensure dashboard Due Soon card and Maintenance overview agree.
- [x] Keep time-based recurring reminders as a later phase unless the odometer-based flow is fully stable.
- [x] Run lint/build.
- [ ] Manual QA:
  - add tracked maintenance
  - edit interval/safety
  - disable category
  - verify dashboard, maintenance overview, and detail modal all match

## Phase 2: Data Health V2

Risk: Medium  
Priority: High

- [ ] Make Data Health items expandable or clickable.
- [ ] Show exact affected entries for each issue group.
- [ ] Add actions:
  - open affected fill-up
  - open affected maintenance entry
  - ignore/dismiss warning locally
- [ ] Add maintenance-specific checks:
  - missing odometer
  - missing category/system mapping
  - duplicate maintenance records
  - deleted/tombstoned records still visible
  - entries with null key fields that may sync incorrectly
- [ ] Add sync/taxonomy checks:
  - custom system exists locally but not cloud
  - custom category exists locally but not cloud
  - maintenance entry has no category/system cloud mapping
- [ ] Run lint/build.

## Phase 3: Backup And Import Polish V2

Risk: Medium  
Priority: Medium-High

- [ ] Add a post-import summary modal.
- [ ] Show:
  - imported records
  - skipped identical records
  - merged records
  - conflicts resolved
  - settings restored
- [ ] Improve backup preview labels for:
  - maintenance systems
  - maintenance subcategories
  - maintenance settings
  - app preferences
- [ ] Add schema compatibility messaging:
  - older backup detected
  - newer backup detected
  - partial backup detected
- [ ] Confirm JSON and Excel remain equivalent in coverage.
- [ ] Run lint/build.

## Phase 4: Manual Sync Modal V2

Risk: Medium  
Priority: Medium

- [ ] Add expandable details under each changed group.
- [ ] Show readable examples such as:
  - system renamed
  - category added
  - category rule edited
  - fill-up changed
  - maintenance entry tombstoned
- [ ] Clearly separate:
  - cloud-only changes
  - local-only changes
  - both-changed conflicts
  - deletions
- [ ] Keep the hidden-control refresh-click behavior unchanged unless explicitly requested.
- [ ] Run lint/build.

## Phase 5: Maintenance PDF And Export Refinement

Risk: Medium  
Priority: Medium

- [ ] Add saved PDF presets.
- [ ] Add preview count before export:
  - number of entries
  - selected systems
  - selected columns
- [ ] Add grouped-by-system PDF option.
- [ ] Add all/active vehicle selection if useful.
- [ ] Ensure custom system and subcategory names display correctly in:
  - add maintenance entry
  - maintenance history
  - PDF export
  - Excel/JSON export
- [ ] Run lint/build.

## Phase 6: Localization Cleanup

Risk: Low  
Priority: Medium

- [ ] Move new hard-coded English strings into i18n.
- [ ] Add Arabic translations for:
  - Data Health panel
  - backup format explanation
  - import review summary
  - sync detail labels
  - PDF selection indicators
- [ ] Check RTL layout for the updated modals/panels.
- [ ] Run lint/build.

## Phase 7: Later Product Improvements

Risk: Medium to High  
Priority: Later

- [ ] Fuel forecast:
  - next fill-up estimate
  - monthly fuel spend estimate
  - remaining range when tank capacity is known
- [ ] Station insights:
  - best/worst station by price
  - best/worst station by efficiency
  - favorite stations
- [ ] Maintenance planner:
  - upcoming service timeline
  - projected service dates
  - maintenance cost forecast
- [ ] Better chart annotations:
  - outlier markers
  - plain-language trend summaries
  - monthly comparisons

## Next Recommended Start

Start with **Phase 1: Maintenance Forecast And Reminder Improvements** as a separate checkpoint. It has the biggest user-facing value, but it should not be mixed with backup/import or sync modal work because it touches due-state logic across Dashboard, Maintenance, and notifications.
