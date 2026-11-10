-- Fixes submit_profile_details(): the original 0001 migration referenced a

drop function if exists public.submit_profile_details(text, text, text, text, text, text);

create or replace function public.submit_profile_details(
    p_full_name text,
    p_course text,
    p_year_level text,
    p_section text,
    p_school text
) returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
    update public.profiles
    set full_name = nullif(trim(p_full_name), ''),
        course = nullif(trim(p_course), ''),
        year_level = nullif(trim(p_year_level), ''),
        section = nullif(trim(p_section), ''),
        school = nullif(trim(p_school), '')
    where id = (select auth.uid())
      and account_status = 'pending';
end;
$$;

grant execute on function public.submit_profile_details(text, text, text, text, text) to authenticated;
