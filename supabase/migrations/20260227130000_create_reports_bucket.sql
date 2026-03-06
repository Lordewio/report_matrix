-- Create reports storage bucket used by report generation uploads
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;

-- Allow authenticated users to list/read report object metadata
create policy "reports_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'reports');
