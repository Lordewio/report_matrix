-- Create attachments storage bucket used by TaskForm uploads
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload attachments
create policy "attachments_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'attachments');

-- Allow authenticated users to read attachment metadata (public bucket still serves files)
create policy "attachments_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'attachments');
