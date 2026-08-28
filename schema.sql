-- Coller dans l'éditeur SQL de Supabase (projet stages-rcfc)

create extension if not exists pgcrypto;

-- ═══════════════════ PÉRIODES DE VACANCES ═══════════════════
create table periodes (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,          -- ex: 'Vacances de la Toussaint'
  date_debut   date not null,
  date_fin     date not null,
  tarif        numeric(6,2),           -- prix du stage, en euros
  places_max   int,                    -- null = illimité
  ordre        int default 0,          -- ordre d'affichage
  actif        boolean default true,   -- masque la période si false
  created_at   timestamptz default now()
);

alter table periodes enable row level security;
create policy "public read periodes actives" on periodes for select using (actif = true);

-- ═══════════════════ INSCRIPTIONS ═══════════════════
create table inscriptions (
  id                uuid primary key default gen_random_uuid(),
  periode_id        uuid not null references periodes(id) on delete cascade,
  nom               text not null,
  prenom            text not null,
  date_naissance    date,
  nom_parent        text,              -- si l'adhérent est mineur
  email             text not null,
  telephone         text,
  paye              boolean not null default false,
  date_inscription  timestamptz default now(),
  date_paiement     timestamptz
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
-- Seules les fonctions security definer ci-dessous peuvent la lire.

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
  select * from periodes order by ordre, date_debut;
$$;
revoke all on function admin_list_periodes() from public;
grant execute on function admin_list_periodes() to anon, authenticated;

create or replace function admin_upsert_periode(
  p_id uuid, p_nom text, p_date_debut date, p_date_fin date,
  p_tarif numeric, p_places_max int, p_ordre int, p_actif boolean
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
    insert into periodes (nom, date_debut, date_fin, tarif, places_max, ordre, actif)
    values (p_nom, p_date_debut, p_date_fin, p_tarif, p_places_max, p_ordre, p_actif)
    returning * into r;
  else
    update periodes set
      nom = p_nom, date_debut = p_date_debut, date_fin = p_date_fin,
      tarif = p_tarif, places_max = p_places_max, ordre = p_ordre, actif = p_actif
    where id = p_id
    returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_periode(uuid,text,date,date,numeric,int,int,boolean) from public;
grant execute on function admin_upsert_periode(uuid,text,date,date,numeric,int,int,boolean) to anon, authenticated;

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

-- ═══════════════════ PUBLIC : places restantes (pas de données perso exposées) ═══════════════════
create or replace function places_prises(p_periode_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from inscriptions where periode_id = p_periode_id;
$$;
revoke all on function places_prises(uuid) from public;
grant execute on function places_prises(uuid) to anon, authenticated;

-- ═══════════════════ DONNÉES DE DÉPART (à ajuster dans l'admin) ═══════════════════
insert into periodes (nom, date_debut, date_fin, tarif, places_max, ordre) values
  ('Vacances de la Toussaint', '2026-10-19', '2026-10-23', 80, 24, 1),
  ('Vacances de Noël',         '2026-12-21', '2026-12-24', 80, 24, 2),
  ('Vacances d''Hiver',        '2027-02-15', '2027-02-19', 80, 24, 3),
  ('Vacances de Printemps',    '2027-04-19', '2027-04-23', 80, 24, 4);
