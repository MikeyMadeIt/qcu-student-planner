-- SUPERSEDED DO NOT EDIT OR RE-ENABLE THIS FILE

do $$
begin
    raise notice
        'Migration 0001_submit_profile_details: no-op. '
        'submit_profile_details() is created by 0005 and finalised by 0019.';
end
$$;
