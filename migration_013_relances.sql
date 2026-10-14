-- Coller dans l'éditeur SQL de Supabase (projet stages-rcfc)

-- ═══════════════════ RELANCES DE PAIEMENT ═══════════════════
-- Chaque clic sur "Relancer" dans l'admin enregistre la date de la relance :
-- la fiche affiche "1re relance envoyée le ...", "2e relance envoyée le ...", etc.

alter table inscriptions add column if not exists relances timestamptz[] not null default '{}';

-- admin_list_inscriptions renvoie "select *" : on la recrée pour qu'elle inclue la nouvelle colonne
create or replace function admin_list_inscriptions(p_periode_id uuid)
returns setof inscriptions
language sql
security definer
set search_path = public
as $$
  select * from inscriptions
  where periode_id = p_periode_id
  order by date_inscription asc;
$$;
revoke all on function admin_list_inscriptions(uuid) from public;
grant execute on function admin_list_inscriptions(uuid) to anon, authenticated;

create or replace function admin_ajouter_relance(p_id uuid)
returns inscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  r inscriptions;
begin
  update inscriptions
    set relances = relances || now()
    where id = p_id
    returning * into r;
  if not found then
    raise exception 'Inscription introuvable';
  end if;
  return r;
end;
$$;
revoke all on function admin_ajouter_relance(uuid) from public;
grant execute on function admin_ajouter_relance(uuid) to anon, authenticated;
