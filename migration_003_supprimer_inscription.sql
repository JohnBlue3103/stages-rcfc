-- Migration à coller dans le SQL Editor Supabase.
-- Ajoute la possibilité de supprimer un adhérent (pré-inscrit ou inscrit) depuis l'admin.

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
