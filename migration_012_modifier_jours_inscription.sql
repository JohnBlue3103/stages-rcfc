-- Coller dans l'éditeur SQL de Supabase (projet stages-rcfc)

-- ═══════════════════ ADMIN : MODIFIER LES JOURS D'UNE INSCRIPTION ═══════════════════
-- Permet à l'admin de corriger les jours choisis par un adhérent (payé ou non).
-- Le montant n'est modifié que si p_montant est fourni : si le nombre de jours par
-- semaine ne change pas, le prix reste identique et on laisse p_montant à null.
--
-- Contrôles : au moins un jour, uniquement des jours de semaine (lundi-vendredi)
-- appartenant à une semaine de la période de l'inscription. Les doublons sont retirés
-- et les jours sont enregistrés triés.

create or replace function admin_update_jours_inscription(
  p_id uuid, p_jours date[], p_montant numeric default null
)
returns inscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  ins   inscriptions;
  jours date[];
  r     inscriptions;
begin
  select * into ins from inscriptions where id = p_id;
  if not found then
    raise exception 'Inscription introuvable';
  end if;

  select coalesce(array_agg(distinct d order by d), '{}')
    into jours
    from unnest(p_jours) as d;

  if coalesce(array_length(jours, 1), 0) = 0 then
    raise exception 'Sélectionnez au moins un jour';
  end if;

  if exists (
    select 1 from unnest(jours) as d
    where extract(isodow from d) > 5
       or not exists (
         select 1 from semaines s
         where s.periode_id = ins.periode_id
           and d between s.date_debut and s.date_fin
       )
  ) then
    raise exception 'Jour invalide : il doit être un jour de semaine (lundi-vendredi) d''une semaine de cette période';
  end if;

  update inscriptions
    set jours_selectionnes = jours,
        montant = coalesce(p_montant, montant)
    where id = p_id
    returning * into r;
  return r;
end;
$$;
revoke all on function admin_update_jours_inscription(uuid, date[], numeric) from public;
grant execute on function admin_update_jours_inscription(uuid, date[], numeric) to anon, authenticated;
