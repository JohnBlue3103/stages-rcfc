-- Migration à coller dans le SQL Editor Supabase.
-- Ajoute : autorisation de droit à l'image, signalement de problèmes de santé,
-- et autorisation d'intervention des éducateurs/personnel médical en cas d'urgence.

alter table inscriptions add column if not exists droit_image boolean not null default false;
alter table inscriptions add column if not exists probleme_sante text;
alter table inscriptions add column if not exists autorisation_intervention boolean not null default false;
