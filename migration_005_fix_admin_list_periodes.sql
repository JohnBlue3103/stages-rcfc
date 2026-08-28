-- Correctif : admin_list_periodes triait encore par date_debut,
-- colonne supprimée par la migration précédente (périodes > semaines).

create or replace function admin_list_periodes()
returns setof periodes
language sql
security definer
set search_path = public
as $$
  select * from periodes order by ordre, nom;
$$;
revoke all on function admin_list_periodes() from public;
grant execute on function admin_list_periodes() to anon, authenticated;
