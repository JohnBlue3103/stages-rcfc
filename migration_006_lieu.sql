-- Migration à coller dans le SQL Editor Supabase.
-- Ajoute un lieu par période (certains stages se déroulent à Ramonville, d'autres à Auzeville).

alter table periodes add column if not exists lieu text;

update periodes set lieu = 'Ramonville' where nom in ('Vacances de la Toussaint', 'Vacances de Printemps', 'Vacances d''été');
update periodes set lieu = 'Auzeville'  where nom in ('Vacances de Noël', 'Vacances d''Hiver');

drop function if exists admin_upsert_periode(uuid,text,int,boolean);

create or replace function admin_upsert_periode(p_id uuid, p_nom text, p_lieu text, p_ordre int, p_actif boolean)
returns periodes
language plpgsql
security definer
set search_path = public
as $$
declare
  r periodes;
begin
  if p_id is null then
    insert into periodes (nom, lieu, ordre, actif) values (p_nom, p_lieu, p_ordre, p_actif) returning * into r;
  else
    update periodes set nom = p_nom, lieu = p_lieu, ordre = p_ordre, actif = p_actif where id = p_id returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function admin_upsert_periode(uuid,text,text,int,boolean) from public;
grant execute on function admin_upsert_periode(uuid,text,text,int,boolean) to anon, authenticated;
