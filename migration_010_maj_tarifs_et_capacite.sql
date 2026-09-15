-- Coller dans l'éditeur SQL de Supabase (projet stages-rcfc)

-- ═══════════════════ MISE À JOUR GRILLE TARIFAIRE ═══════════════════
update grille_tarifs set prix = 40  where nb_jours = 1;
update grille_tarifs set prix = 65  where nb_jours = 2;
update grille_tarifs set prix = 85  where nb_jours = 3;
update grille_tarifs set prix = 100 where nb_jours = 4;
update grille_tarifs set prix = 110 where nb_jours = 5;

-- ═══════════════════ CAPACITÉ PAR SEMAINE (places disponibles) ═══════════════════
alter table semaines add column if not exists capacite int not null default 16;

-- Nombre de places restantes pour une semaine donnée : capacité moins le nombre
-- d'inscriptions (payées ou en attente) ayant choisi au moins un jour de cette semaine.
-- Fonction publique (pas de données perso exposées, juste un compteur) pour que le
-- site puisse afficher "X places restantes" avant que le parent ne s'inscrive.
create or replace function semaine_places_restantes(p_semaine_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select greatest(
    s.capacite - coalesce((
      select count(*)
      from inscriptions i
      where i.periode_id = s.periode_id
        and exists (
          select 1 from unnest(i.jours_selectionnes) as d
          where d between s.date_debut and s.date_fin
        )
    ), 0),
    0
  )
  from semaines s
  where s.id = p_semaine_id;
$$;
revoke all on function semaine_places_restantes(uuid) from public;
grant execute on function semaine_places_restantes(uuid) to anon, authenticated;

-- admin_upsert_semaine doit maintenant aussi gérer la capacité
drop function if exists admin_upsert_semaine(uuid, uuid, text, date, date, int);

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
    values (p_periode_id, p_nom, p_date_debut, p_date_fin, p_ordre, coalesce(p_capacite, 16))
    returning * into r;
  else
    update semaines set nom = p_nom, date_debut = p_date_debut, date_fin = p_date_fin, ordre = p_ordre,
      capacite = coalesce(p_capacite, 16)
    where id = p_id
    returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_semaine(uuid,uuid,text,date,date,int,int) from public;
grant execute on function admin_upsert_semaine(uuid,uuid,text,date,date,int,int) to anon, authenticated;
