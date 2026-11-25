begin;
-- Read-only roster, limited to administrators and assigned foremen.
create or replace function public.sylaj_hours_workers()
returns table(id bigint, ime_priimek text, ekipa_id text, aktiven boolean)
language sql stable security definer set search_path='' as $$
 select d.id::bigint,d.ime_priimek::text,d.ekipa_id::text,d.aktiven
 from public.delavci d where d.izbrisano_at is null
 and (public.eshte_admin() or exists(select 1 from public.ekipe e where e.vodja_id=auth.uid()))
 order by d.ime_priimek;
$$;
revoke all on function public.sylaj_hours_workers() from public,anon;
grant execute on function public.sylaj_hours_workers() to authenticated;
-- Preserve the explicitly selected team instead of overwriting it with the worker's home team.
create or replace function public.ruaj_ekipen_e_ores() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.ekipa_id is null then raise exception 'Ekipa je obvezna'; end if;
 if not exists(select 1 from public.delavci d where d.id=new.delavec_id and d.aktiven and d.izbrisano_at is null) then raise exception 'Neveljaven delavec'; end if;
 if not coalesce(public.eshte_admin(),false) then
  if not exists(select 1 from public.ekipe e where e.id=new.ekipa_id and e.vodja_id=auth.uid() and e.aktivno_gradbisce_id=new.gradbisce_id) then raise exception 'Izberite aktivno gradbišče svoje ekipe'; end if;
  if new.datum<>(now() at time zone 'Europe/Ljubljana')::date or new.vnesel_id is distinct from auth.uid() or nullif(trim(new.opomba),'') is null then raise exception 'Neveljaven vnos ur'; end if;
 end if;
 return new;
end $$;
-- Fail atomically if the expected trigger is absent or uses another function.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.delovne_ure'::regclass and t.tgfoid='public.ruaj_ekipen_e_ores()'::regprocedure and not t.tgisinternal) then raise exception 'Preverite obstoječi trigger za ekipo'; end if;
end $$;
drop policy if exists sylaj_hours_cross_worker_insert on public.delovne_ure;
create policy sylaj_hours_cross_worker_insert on public.delovne_ure for insert to authenticated with check (exists(select 1 from public.ekipe e where e.id=ekipa_id and e.vodja_id=auth.uid()) and vnesel_id=auth.uid());
commit;
