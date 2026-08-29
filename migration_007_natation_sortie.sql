-- Migration à coller dans le SQL Editor Supabase.
-- Ajoute : indicateur "séance de natation" par période (affiche une case à cocher
-- de confirmation "sait nager"), et une autorisation de sortie hors stade (cinéma,
-- centre culturel...) demandée à toutes les inscriptions.

alter table periodes add column if not exists piscine boolean not null default false;

alter table inscriptions add column if not exists autorisation_sortie boolean not null default false;
alter table inscriptions add column if not exists sait_nager boolean;

drop function if exists admin_upsert_periode(uuid,text,text,int,boolean);

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
