-- Migration à coller dans le SQL Editor Supabase (base déjà existante).
-- Passage à un modèle "périodes > semaines" : une période (Toussaint, Été...) peut
-- désormais contenir une ou plusieurs semaines, et le parent choisit celle(s) qui
-- l'intéresse(nt) (Toussaint = 2 semaines réelles, Été = plusieurs semaines).

-- ═══ Nouvelle table semaines ═══
create table semaines (
  id          uuid primary key default gen_random_uuid(),
  periode_id  uuid not null references periodes(id) on delete cascade,
  nom         text not null,          -- ex: 'Semaine 1'
  date_debut  date not null,
  date_fin    date not null,
  ordre       int default 0,
  created_at  timestamptz default now()
);

alter table semaines enable row level security;
create policy "public read semaines" on semaines
  for select using (exists (select 1 from periodes p where p.id = semaines.periode_id and p.actif = true));

-- ═══ Migre les données existantes : chaque période devient sa "Semaine 1" ═══
insert into semaines (periode_id, nom, date_debut, date_fin, ordre)
select id, 'Semaine 1', date_debut, date_fin, 1 from periodes;

-- Toussaint dure en réalité 2 semaines : on ajoute la 2e (dates à ajuster dans l'admin)
insert into semaines (periode_id, nom, date_debut, date_fin, ordre)
select id, 'Semaine 2', '2026-10-26', '2026-10-30', 2
from periodes where nom = 'Vacances de la Toussaint';

-- ═══ Les périodes n'ont plus de dates/places propres (déplacées dans semaines) ═══
alter table periodes drop column if exists date_debut;
alter table periodes drop column if exists date_fin;
alter table periodes drop column if exists places_max;

-- admin_upsert_periode change de signature (plus de dates/places)
drop function if exists admin_upsert_periode(uuid,text,date,date,int,int,boolean);

create or replace function admin_upsert_periode(p_id uuid, p_nom text, p_ordre int, p_actif boolean)
returns periodes
language plpgsql
security definer
set search_path = public
as $$
declare
  r periodes;
begin
  if p_id is null then
    insert into periodes (nom, ordre, actif) values (p_nom, p_ordre, p_actif) returning * into r;
  else
    update periodes set nom = p_nom, ordre = p_ordre, actif = p_actif where id = p_id returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_periode(uuid,text,int,boolean) from public;
grant execute on function admin_upsert_periode(uuid,text,int,boolean) to anon, authenticated;

-- ═══ Gestion des semaines (admin) ═══
create or replace function admin_list_semaines(p_periode_id uuid)
returns setof semaines
language sql
security definer
set search_path = public
as $$
  select * from semaines where periode_id = p_periode_id order by ordre, date_debut;
$$;
revoke all on function admin_list_semaines(uuid) from public;
grant execute on function admin_list_semaines(uuid) to anon, authenticated;

create or replace function admin_upsert_semaine(
  p_id uuid, p_periode_id uuid, p_nom text, p_date_debut date, p_date_fin date, p_ordre int
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
    insert into semaines (periode_id, nom, date_debut, date_fin, ordre)
    values (p_periode_id, p_nom, p_date_debut, p_date_fin, p_ordre)
    returning * into r;
  else
    update semaines set nom = p_nom, date_debut = p_date_debut, date_fin = p_date_fin, ordre = p_ordre
    where id = p_id
    returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_semaine(uuid,uuid,text,date,date,int) from public;
grant execute on function admin_upsert_semaine(uuid,uuid,text,date,date,int) to anon, authenticated;

create or replace function admin_delete_semaine(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from semaines where id = p_id;
$$;
revoke all on function admin_delete_semaine(uuid) from public;
grant execute on function admin_delete_semaine(uuid) to anon, authenticated;

-- ═══ places_prises n'est plus utile (places_max retiré des périodes) ═══
drop function if exists places_prises(uuid);

-- ═══ Ajout de la période "Vacances d'été" avec plusieurs semaines (dates à ajuster) ═══
with nouvelle_periode as (
  insert into periodes (nom, ordre) values ('Vacances d''été', 5) returning id
)
insert into semaines (periode_id, nom, date_debut, date_fin, ordre)
select nouvelle_periode.id, s.nom, s.date_debut, s.date_fin, s.ordre
from nouvelle_periode, (values
  ('Semaine 1', '2027-07-05'::date, '2027-07-09'::date, 1),
  ('Semaine 2', '2027-07-12'::date, '2027-07-16'::date, 2),
  ('Semaine 3', '2027-07-19'::date, '2027-07-23'::date, 3),
  ('Semaine 4', '2027-07-26'::date, '2027-07-30'::date, 4),
  ('Semaine 5', '2027-08-02'::date, '2027-08-06'::date, 5),
  ('Semaine 6', '2027-08-09'::date, '2027-08-13'::date, 6),
  ('Semaine 7', '2027-08-16'::date, '2027-08-20'::date, 7),
  ('Semaine 8', '2027-08-23'::date, '2027-08-27'::date, 8)
) as s(nom, date_debut, date_fin, ordre);
