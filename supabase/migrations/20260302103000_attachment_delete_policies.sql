-- Allow attachment owners/admins to delete attachment metadata rows
create policy "delete_attachment_task_owner"
on public.attachments
for delete
using (
  exists(
    select 1
    from public.tasks t
    where t.id = attachments.task_id
      and (t.author_id = auth.uid() or public.is_admin())
  )
);

-- Allow attachment owners/admins to delete stored files from attachments bucket
create policy "attachments_delete_task_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and exists(
    select 1
    from public.tasks t
    where t.id::text = split_part(storage.objects.name, '/', 1)
      and (t.author_id = auth.uid() or public.is_admin())
  )
);
