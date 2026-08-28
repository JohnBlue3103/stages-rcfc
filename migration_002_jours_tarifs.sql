-- Migration à coller dans le SQL Editor Supabase (base déjà existante).
-- Ajoute : sélection des jours à la carte, grille tarifaire dégressive, tarif réduit fratrie.

-- ═══ Nouvelles colonnes sur inscriptions ═══
alter table inscriptions add column if not exists jours_selectionnes date[] not null default '{}';
alter table inscriptions add column if not exists tarif_reduit boolean not null default false;
alter table inscriptions add column if not exists montant numeric(6,2);

-- ═══ Grille tarifaire ═══
create table if not exists grille_tarifs (
  nb_jours int primary key check (nb_jours between 1 and 5),
  prix     numeric(6,2) not null
);

alter table grille_tarifs enable row level security;
drop policy if exists "public read grille_tarifs" on grille_tarifs;
create policy "public read grille_tarifs" on grille_tarifs for select using (true);

insert into grille_tarifs (nb_jours, prix) values
  (1, 32), (2, 60), (3, 85), (4, 108), (5, 130)
on conflict (nb_jours) do nothing;

create or replace function admin_set_tarif(p_nb_jours int, p_prix numeric)
returns grille_tarifs
language plpgsql
security definer
set search_path = public
as $$
declare
  r grille_tarifs;
begin
  update grille_tarifs set prix = p_prix where nb_jours = p_nb_jours returning * into r;
  return r;
end;
$$;
revoke all on function admin_set_tarif(int, numeric) from public;
grant execute on function admin_set_tarif(int, numeric) to anon, authenticated;

-- ═══ admin_upsert_periode change de signature (le tarif n'est plus par période) ═══
drop function if exists admin_upsert_periode(uuid,text,date,date,numeric,int,int,boolean);

create or replace function admin_upsert_periode(
  p_id uuid, p_nom text, p_date_debut date, p_date_fin date,
  p_places_max int, p_ordre int, p_actif boolean
)
returns periodes
language plpgsql
security definer
set search_path = public
as $$
declare
  r periodes;
begin
  if p_id is null then
    insert into periodes (nom, date_debut, date_fin, places_max, ordre, actif)
    values (p_nom, p_date_debut, p_date_fin, p_places_max, p_ordre, p_actif)
    returning * into r;
  else
    update periodes set
      nom = p_nom, date_debut = p_date_debut, date_fin = p_date_fin,
      places_max = p_places_max, ordre = p_ordre, actif = p_actif
    where id = p_id
    returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_periode(uuid,text,date,date,int,int,boolean) from public;
grant execute on function admin_upsert_periode(uuid,text,date,date,int,int,boolean) to anon, authenticated;

-- ═══ Nettoyage : le tarif par période n'existe plus (remplacé par la grille) ═══
alter table periodes drop column if exists tarif;
