begin;
alter table public.gradbisca add column if not exists sylaj_active boolean not null default false;
create unique index if not exists sylaj_one_active_site on public.gradbisca(ekipa_id) where sylaj_active and izbrisano_at is null;
create or replace function public.sylaj_team_allowed(p_team text) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.eshte_admin(),false) or exists(select 1 from public.ekipe where id::text=p_team and vodja_id=auth.uid()) $$;
create or replace function public.sylaj_site_allowed(p_site text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.gradbisca g where g.id::text=p_site and g.izbrisano_at is null and public.sylaj_team_allowed(g.ekipa_id::text)) $$;
create or replace function public.sylaj_site_activate(p_site text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare g public.gradbisca%rowtype;
begin
 select * into g from public.gradbisca where id::text=p_site and izbrisano_at is null;
 if not found or g.ekipa_id is null or not public.sylaj_team_allowed(g.ekipa_id::text) then raise exception 'Dostop zavrnjen'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sylaj-site-'||g.ekipa_id::text,0));
 if p_active then update public.gradbisca set sylaj_active=false where ekipa_id=g.ekipa_id and sylaj_active; end if;
 update public.gradbisca set sylaj_active=p_active where id=g.id;
end $$;
create or replace function public.sylaj_site_create(p_name text,p_address text,p_team text) returns text language plpgsql security definer set search_path='' as $$
declare e public.ekipe%rowtype; new_id text;
begin
 if not public.sylaj_team_allowed(p_team) or nullif(trim(p_name),'') is null then raise exception 'Dostop zavrnjen'; end if;
 select * into strict e from public.ekipe where id::text=p_team;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sylaj-site-'||p_team,0));
 update public.gradbisca set sylaj_active=false where ekipa_id=e.id and sylaj_active;
 insert into public.gradbisca(naziv,naslov,ekipa_id,sylaj_active) values(trim(p_name),p_address,e.id,true) returning id::text into new_id;
 return new_id;
end $$;
revoke all on function public.sylaj_site_create(text,text,text),public.sylaj_site_activate(text,boolean),public.sylaj_team_allowed(text),public.sylaj_site_allowed(text) from public,anon;
grant execute on function public.sylaj_site_create(text,text,text),public.sylaj_site_activate(text,boolean),public.sylaj_team_allowed(text),public.sylaj_site_allowed(text) to authenticated;
alter table public.gradbisca enable row level security;
drop policy if exists sylaj_site_scope on public.gradbisca;
create policy sylaj_site_scope on public.gradbisca as restrictive for select to authenticated using(public.sylaj_team_allowed(ekipa_id::text));
drop policy if exists sylaj_site_read on public.gradbisca;
create policy sylaj_site_read on public.gradbisca for select to authenticated using(public.sylaj_team_allowed(ekipa_id::text));
alter table public.sylaj_site_photos enable row level security;
drop policy if exists sylaj_photo_scope on public.sylaj_site_photos;
create policy sylaj_photo_scope on public.sylaj_site_photos as restrictive for all to authenticated using(public.sylaj_site_allowed(site_id::text)) with check(public.sylaj_site_allowed(site_id::text));
drop policy if exists sylaj_photo_read on public.sylaj_site_photos;
create policy sylaj_photo_read on public.sylaj_site_photos for select to authenticated using(public.sylaj_site_allowed(site_id::text));
drop policy if exists sylaj_photo_add on public.sylaj_site_photos;
create policy sylaj_photo_add on public.sylaj_site_photos for insert to authenticated with check(public.sylaj_site_allowed(site_id::text) and created_by=auth.uid());
drop policy if exists sylaj_storage_scope on storage.objects;
create policy sylaj_storage_scope on storage.objects as restrictive for all to authenticated using(bucket_id<>'sylaj-site-photos' or public.sylaj_site_allowed(split_part(name,'/',1))) with check(bucket_id<>'sylaj-site-photos' or public.sylaj_site_allowed(split_part(name,'/',1)));
drop policy if exists sylaj_storage_read on storage.objects;
create policy sylaj_storage_read on storage.objects for select to authenticated using(bucket_id='sylaj-site-photos' and public.sylaj_site_allowed(split_part(name,'/',1)));
drop policy if exists sylaj_storage_add on storage.objects;
create policy sylaj_storage_add on storage.objects for insert to authenticated with check(bucket_id='sylaj-site-photos' and public.sylaj_site_allowed(split_part(name,'/',1)));
update storage.buckets set public=false where id='sylaj-site-photos';
commit;
