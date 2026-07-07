-- Simple Fuel Tracker duplicate cleanup helper
-- Date: 2026-07-07
--
-- Purpose:
-- 1. Inspect cloud rows created by older sync bugs, especially active rows with NULL stable_key.
-- 2. Backfill active NULL stable_key rows safely.
-- 3. Optionally soft-delete exact active duplicates after review.
--
-- IMPORTANT:
-- - Run the DRY RUN sections first.
-- - Do not run the OPTIONAL UPDATE sections until the returned rows look correct.
-- - This script soft-deletes duplicate losers by setting deleted_at; it does not hard-delete rows.
-- - If you want to limit to one user, replace the commented user_id filters with your user id.

begin;

-- ============================================================
-- A. DRY RUN: active rows that still have NULL stable_key
-- ============================================================

select
  'fillups_missing_stable_key' as issue,
  id,
  user_id,
  vehicle_id,
  date,
  odometer,
  liters,
  price_per_liter,
  total_cost,
  created_at,
  updated_at,
  deleted_at
from public.fillups
where deleted_at is null
  and stable_key is null
-- and user_id = '00000000-0000-0000-0000-000000000000'
order by vehicle_id, date, odometer;

select
  'maintenance_missing_stable_key' as issue,
  id,
  user_id,
  vehicle_id,
  date,
  type,
  odometer,
  next_due_odometer,
  description,
  created_at,
  updated_at,
  deleted_at
from public.maintenance
where deleted_at is null
  and stable_key is null
-- and user_id = '00000000-0000-0000-0000-000000000000'
order by vehicle_id, date, type, odometer;


-- ============================================================
-- B. DRY RUN: exact active duplicate fill-ups
-- ============================================================

with ranked_fillups as (
  select
    f.*,
    count(*) over (
      partition by
        user_id,
        vehicle_id,
        date,
        round(odometer::numeric, 2),
        round(liters::numeric, 2),
        round(price_per_liter::numeric, 3),
        round(total_cost::numeric, 2)
    ) as duplicate_count,
    row_number() over (
      partition by
        user_id,
        vehicle_id,
        date,
        round(odometer::numeric, 2),
        round(liters::numeric, 2),
        round(price_per_liter::numeric, 3),
        round(total_cost::numeric, 2)
      order by
        case when stable_key is not null and stable_key <> id::text then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.fillups f
  where f.deleted_at is null
  -- and f.user_id = '00000000-0000-0000-0000-000000000000'
)
select
  'fillup_active_duplicate' as issue,
  case when keep_rank = 1 then 'KEEP' else 'SOFT_DELETE_CANDIDATE' end as recommended_action,
  id,
  stable_key,
  user_id,
  vehicle_id,
  date,
  odometer,
  liters,
  price_per_liter,
  total_cost,
  created_at,
  updated_at,
  duplicate_count,
  keep_rank
from ranked_fillups
where duplicate_count > 1
order by vehicle_id, date, odometer, keep_rank;


-- ============================================================
-- C. DRY RUN: exact active duplicate maintenance records
-- ============================================================

with ranked_maintenance as (
  select
    m.*,
    count(*) over (
      partition by
        user_id,
        vehicle_id,
        date,
        coalesce(type, ''),
        coalesce(round(odometer::numeric, 2)::text, ''),
        coalesce(round(next_due_odometer::numeric, 2)::text, ''),
        coalesce(cost::text, ''),
        coalesce(description, '')
    ) as duplicate_count,
    row_number() over (
      partition by
        user_id,
        vehicle_id,
        date,
        coalesce(type, ''),
        coalesce(round(odometer::numeric, 2)::text, ''),
        coalesce(round(next_due_odometer::numeric, 2)::text, ''),
        coalesce(cost::text, ''),
        coalesce(description, '')
      order by
        case when stable_key is not null and stable_key <> id::text then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.maintenance m
  where m.deleted_at is null
  -- and m.user_id = '00000000-0000-0000-0000-000000000000'
)
select
  'maintenance_active_duplicate' as issue,
  case when keep_rank = 1 then 'KEEP' else 'SOFT_DELETE_CANDIDATE' end as recommended_action,
  id,
  stable_key,
  user_id,
  vehicle_id,
  date,
  type,
  odometer,
  next_due_odometer,
  cost,
  description,
  created_at,
  updated_at,
  duplicate_count,
  keep_rank
from ranked_maintenance
where duplicate_count > 1
order by vehicle_id, date, type, odometer, keep_rank;


-- ============================================================
-- D. OPTIONAL SAFE UPDATE: backfill active NULL stable_key rows
-- ============================================================
-- This does not remove any data. It makes previously bad rows syncable.
-- Uncomment only after reviewing section A.

/*
update public.fillups
set
  stable_key = id::text,
  updated_at = now()
where deleted_at is null
  and stable_key is null
-- and user_id = '00000000-0000-0000-0000-000000000000'
returning
  'fillup_stable_key_backfilled' as action,
  id,
  stable_key,
  vehicle_id,
  date,
  odometer,
  liters,
  total_cost,
  updated_at;

update public.maintenance
set
  stable_key = id::text,
  updated_at = now()
where deleted_at is null
  and stable_key is null
-- and user_id = '00000000-0000-0000-0000-000000000000'
returning
  'maintenance_stable_key_backfilled' as action,
  id,
  stable_key,
  vehicle_id,
  date,
  type,
  odometer,
  next_due_odometer,
  updated_at;
*/


-- ============================================================
-- E. OPTIONAL UPDATE: soft-delete exact active duplicate losers
-- ============================================================
-- Run after D, then rerun sections B/C and confirm the candidates still make sense.

/*
with ranked_fillups as (
  select
    f.id,
    row_number() over (
      partition by
        user_id,
        vehicle_id,
        date,
        round(odometer::numeric, 2),
        round(liters::numeric, 2),
        round(price_per_liter::numeric, 3),
        round(total_cost::numeric, 2)
      order by
        case when stable_key is not null and stable_key <> id::text then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.fillups f
  where f.deleted_at is null
  -- and f.user_id = '00000000-0000-0000-0000-000000000000'
),
losers as (
  select id from ranked_fillups where keep_rank > 1
)
update public.fillups f
set
  deleted_at = now(),
  updated_at = now()
from losers
where f.id = losers.id
returning
  'fillup_duplicate_soft_deleted' as action,
  f.id,
  f.stable_key,
  f.vehicle_id,
  f.date,
  f.odometer,
  f.liters,
  f.total_cost,
  f.deleted_at;

with ranked_maintenance as (
  select
    m.id,
    row_number() over (
      partition by
        user_id,
        vehicle_id,
        date,
        coalesce(type, ''),
        coalesce(round(odometer::numeric, 2)::text, ''),
        coalesce(round(next_due_odometer::numeric, 2)::text, ''),
        coalesce(cost::text, ''),
        coalesce(description, '')
      order by
        case when stable_key is not null and stable_key <> id::text then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.maintenance m
  where m.deleted_at is null
  -- and m.user_id = '00000000-0000-0000-0000-000000000000'
),
losers as (
  select id from ranked_maintenance where keep_rank > 1
)
update public.maintenance m
set
  deleted_at = now(),
  updated_at = now()
from losers
where m.id = losers.id
returning
  'maintenance_duplicate_soft_deleted' as action,
  m.id,
  m.stable_key,
  m.vehicle_id,
  m.date,
  m.type,
  m.odometer,
  m.next_due_odometer,
  m.deleted_at;
*/

rollback;

-- Keep the final rollback while testing. If you intentionally run an optional update,
-- change the final line from rollback; to commit; after reviewing the returning rows.
