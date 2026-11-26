-- Allows closing the current site without deleting any work hours.
begin;
grant delete on public.aktivna_gradbisca to authenticated;
drop policy if exists sylaj_active_site_delete on public.aktivna_gradbisca;
create policy sylaj_active_site_delete on public.aktivna_gradbisca for delete to authenticated using (exists(select 1 from public.profili p where p.id=auth.uid() and p.vloga in ('admin','administrator','skrbnik')) or exists(select 1 from public.ekipe e where e.id=aktivna_gradbisca.ekipa_id and e.vodja_id=auth.uid()));
commit;
