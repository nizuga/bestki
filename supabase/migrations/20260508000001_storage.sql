-- Storage bucket for card images
-- Public read since the app is single-user without auth (per PROYECTO_CONTEXTO.md)

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;
