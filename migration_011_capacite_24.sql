-- Coller dans l'éditeur SQL de Supabase (projet stages-rcfc)

-- ═══════════════════ CAPACITÉ PAR SEMAINE : 16 → 24 places ═══════════════════

-- Nouvelle valeur par défaut pour les semaines futures
alter table semaines alter column capacite set default 24;

-- Semaines existantes déjà à 16 (valeur par défaut d'origine, pas encore
-- personnalisée) : on les passe à 24. Une semaine dont la capacité aurait déjà
-- été ajustée manuellement à une autre valeur n'est pas touchée.
update semaines set capacite = 24 where capacite = 16;

-- admin_upsert_semaine : le fallback quand p_capacite est null passe aussi à 24
create or replace function admin_upsert_semaine(
  p_id uuid, p_periode_id uuid, p_nom text, p_date_debut date, p_date_fin date, p_ordre int, p_capacite int
)
returns semaines
language plpgsql
security definer
set search_path = public
as $$
declare
  r semaines;
begin
  if p_id is null then
    insert into semaines (periode_id, nom, date_debut, date_fin, ordre, capacite)
    values (p_periode_id, p_nom, p_date_debut, p_date_fin, p_ordre, coalesce(p_capacite, 24))
    returning * into r;
  else
    update semaines set nom = p_nom, date_debut = p_date_debut, date_fin = p_date_fin, ordre = p_ordre,
      capacite = coalesce(p_capacite, 24)
    where id = p_id
    returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_semaine(uuid,uuid,text,date,date,int,int) from public;
grant execute on function admin_upsert_semaine(uuid,uuid,text,date,date,int,int) to anon, authenticated;
