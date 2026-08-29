-- Coller dans l'éditeur SQL de Supabase (projet stages-rcfc)
-- (schéma complet — pour une remise à zéro / nouvelle installation.
--  Si la base existe déjà, utiliser plutôt les scripts migration_00X_*.sql fournis séparément.)

create extension if not exists pgcrypto;

-- ═══════════════════ PÉRIODES DE VACANCES ═══════════════════
-- Une période (ex: 'Vacances de la Toussaint') regroupe une ou plusieurs semaines.
create table periodes (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  lieu         text,                   -- ex: 'Ramonville', 'Auzeville'
  piscine      boolean not null default false, -- séance de natation incluse (case "sait nager" à l'inscription)
  ordre        int default 0,          -- ordre d'affichage
  actif        boolean default true,   -- masque la période si false
  created_at   timestamptz default now()
);

alter table periodes enable row level security;
create policy "public read periodes actives" on periodes for select using (actif = true);

-- ═══════════════════ SEMAINES ═══════════════════
-- Chaque période contient une ou plusieurs semaines, que le parent choisit à l'inscription.
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

-- ═══════════════════ GRILLE TARIFAIRE (dégressive, par nombre de jours, par semaine) ═══════════════════
create table grille_tarifs (
  nb_jours int primary key check (nb_jours between 1 and 5),
  prix     numeric(6,2) not null
);

alter table grille_tarifs enable row level security;
create policy "public read grille_tarifs" on grille_tarifs for select using (true);

insert into grille_tarifs (nb_jours, prix) values
  (1, 32), (2, 60), (3, 85), (4, 108), (5, 130);

-- ═══════════════════ INSCRIPTIONS ═══════════════════
create table inscriptions (
  id                 uuid primary key default gen_random_uuid(),
  periode_id         uuid not null references periodes(id) on delete cascade,
  nom                text not null,
  prenom             text not null,
  date_naissance     date,
  nom_parent         text,              -- si l'adhérent est mineur
  email              text not null,
  telephone          text,
  jours_selectionnes date[] not null default '{}',  -- jours choisis, toutes semaines confondues
  tarif_reduit       boolean not null default false, -- -20% fratrie (2e enfant et suivants)
  montant            numeric(6,2),      -- montant dû, calculé et figé au moment de l'inscription
  autorisation_sortie boolean not null default false, -- sortie hors stade avec l'éducateur (cinéma, centre culturel...)
  sait_nager         boolean,           -- pertinent seulement si la période inclut une séance de natation
  droit_image        boolean not null default false, -- autorisation d'utiliser l'image de l'enfant
  probleme_sante     text,              -- allergies, problèmes de santé à signaler (facultatif)
  autorisation_intervention boolean not null default false, -- intervention éducateurs/personnel médical en cas d'urgence
  paye               boolean not null default false,
  date_inscription   timestamptz default now(),
  date_paiement      timestamptz
);

alter table inscriptions enable row level security;

-- Le public peut créer une pré-inscription. Aucune policy de lecture :
-- les données personnelles (nom, email, tel...) ne sont jamais lisibles
-- directement depuis le client, seulement via les fonctions admin ci-dessous.
create policy "public insert inscriptions" on inscriptions
  for insert with check (true);

-- ═══════════════════ MOT DE PASSE ADMIN ═══════════════════
create table admin_config (
  id       int primary key default 1,
  mdp_hash text not null
);
alter table admin_config enable row level security;
-- Aucune policy => table totalement inaccessible depuis le client (même en lecture).
-- Seules les fonctions security definer ci-dessous peuvent y accéder.

insert into admin_config (id, mdp_hash) values (1, crypt('stagesRcfc!1', gen_salt('bf')));

-- Pour changer le mot de passe plus tard, exécuter dans le SQL editor Supabase :
-- update admin_config set mdp_hash = crypt('NouveauMdp', gen_salt('bf')) where id = 1;

create or replace function verify_mdp_admin(mdp text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select mdp_hash = crypt(mdp, mdp_hash) from admin_config where id = 1;
$$;

revoke all on function verify_mdp_admin(text) from public;
grant execute on function verify_mdp_admin(text) to anon, authenticated;

-- ═══════════════════ ADMIN : PÉRIODES ═══════════════════
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

create or replace function admin_upsert_periode(
  p_id uuid, p_nom text, p_lieu text, p_piscine boolean, p_ordre int, p_actif boolean
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
    insert into periodes (nom, lieu, piscine, ordre, actif)
    values (p_nom, p_lieu, p_piscine, p_ordre, p_actif)
    returning * into r;
  else
    update periodes set nom = p_nom, lieu = p_lieu, piscine = p_piscine, ordre = p_ordre, actif = p_actif
    where id = p_id
    returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_periode(uuid,text,text,boolean,int,boolean) from public;
grant execute on function admin_upsert_periode(uuid,text,text,boolean,int,boolean) to anon, authenticated;

create or replace function admin_delete_periode(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from periodes where id = p_id;
$$;
revoke all on function admin_delete_periode(uuid) from public;
grant execute on function admin_delete_periode(uuid) to anon, authenticated;

-- ═══════════════════ ADMIN : SEMAINES ═══════════════════
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

-- ═══════════════════ ADMIN : GRILLE TARIFAIRE ═══════════════════
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

-- ═══════════════════ ADMIN : INSCRIPTIONS ═══════════════════
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

create or replace function admin_marquer_paye(p_id uuid, p_paye boolean)
returns inscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  r inscriptions;
begin
  update inscriptions
    set paye = p_paye,
        date_paiement = case when p_paye then now() else null end
    where id = p_id
    returning * into r;
  return r;
end;
$$;
revoke all on function admin_marquer_paye(uuid, boolean) from public;
grant execute on function admin_marquer_paye(uuid, boolean) to anon, authenticated;

create or replace function admin_delete_inscription(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from inscriptions where id = p_id;
$$;
revoke all on function admin_delete_inscription(uuid) from public;
grant execute on function admin_delete_inscription(uuid) to anon, authenticated;

-- ═══════════════════ DONNÉES DE DÉPART (à ajuster dans l'admin) ═══════════════════
with p1 as (insert into periodes (nom, lieu, ordre) values ('Vacances de la Toussaint', 'Ramonville', 1) returning id),
     p2 as (insert into periodes (nom, lieu, ordre) values ('Vacances de Noël', 'Auzeville', 2) returning id),
     p3 as (insert into periodes (nom, lieu, ordre) values ('Vacances d''Hiver', 'Auzeville', 3) returning id),
     p4 as (insert into periodes (nom, lieu, ordre) values ('Vacances de Printemps', 'Ramonville', 4) returning id),
     p5 as (insert into periodes (nom, lieu, ordre) values ('Vacances d''été', 'Ramonville', 5) returning id)
insert into semaines (periode_id, nom, date_debut, date_fin, ordre)
select id, nom, date_debut, date_fin, ordre from (
  select p1.id, s.* from p1, (values
    ('Semaine 1', '2026-10-19'::date, '2026-10-23'::date, 1),
    ('Semaine 2', '2026-10-26'::date, '2026-10-30'::date, 2)
  ) as s(nom, date_debut, date_fin, ordre)
  union all
  select p2.id, s.* from p2, (values
    ('Semaine 1', '2026-12-21'::date, '2026-12-24'::date, 1)
  ) as s(nom, date_debut, date_fin, ordre)
  union all
  select p3.id, s.* from p3, (values
    ('Semaine 1', '2027-02-15'::date, '2027-02-19'::date, 1)
  ) as s(nom, date_debut, date_fin, ordre)
  union all
  select p4.id, s.* from p4, (values
    ('Semaine 1', '2027-04-19'::date, '2027-04-23'::date, 1)
  ) as s(nom, date_debut, date_fin, ordre)
  union all
  select p5.id, s.* from p5, (values
    ('Semaine 1', '2027-07-05'::date, '2027-07-09'::date, 1),
    ('Semaine 2', '2027-07-12'::date, '2027-07-16'::date, 2),
    ('Semaine 3', '2027-07-19'::date, '2027-07-23'::date, 3),
    ('Semaine 4', '2027-07-26'::date, '2027-07-30'::date, 4),
    ('Semaine 5', '2027-08-02'::date, '2027-08-06'::date, 5),
    ('Semaine 6', '2027-08-09'::date, '2027-08-13'::date, 6),
    ('Semaine 7', '2027-08-16'::date, '2027-08-20'::date, 7),
    ('Semaine 8', '2027-08-23'::date, '2027-08-27'::date, 8)
  ) as s(nom, date_debut, date_fin, ordre)
) as t (periode_id, nom, date_debut, date_fin, ordre);
