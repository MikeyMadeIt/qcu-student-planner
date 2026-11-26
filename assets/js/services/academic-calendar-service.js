import { getSupabase } from '../core/supabase-client.js';

function fail(error) {
    if (error && error.code === '42501') return { ok: false, message: 'You are not authorized to manage the university academic calendar.' };
    if (error && error.code === '22023') return { ok: false, message: error.message || 'Review the academic period details.' };
    if (error && error.code === '23505') return { ok: false, message: error.message || 'That academic period already exists.' };
    if (error && error.code === 'P0002') return { ok: false, message: error.message || 'That academic period could not be found.' };
    return { ok: false, message: 'The university academic calendar could not be loaded. Try again.' };
}

function isCalendarMigrationMissing(error) {
    return !!error && (error.code === '42P01' || /relation .* does not exist/i.test(error.message || ''));
}

export const AcademicCalendarService = {
    async getCalendar() {
        try {
            const supabase = getSupabase();
            const [settingResult, yearResult, semesterResult] = await Promise.all([
                supabase.from('system_settings').select('active_semester_id, updated_at').eq('id', true).maybeSingle(),
                supabase.from('academic_years').select('id, name, start_date, end_date, status, created_at, updated_at').order('start_date', { ascending: false }),
                supabase.from('semesters').select('id, academic_year_id, name, school_year, start_date, end_date, finals_date, total_weeks, status, is_university_wide, created_at, updated_at').eq('is_university_wide', true).order('start_date', { ascending: false }),
            ]);
            const error = settingResult.error || yearResult.error || semesterResult.error;
            if (isCalendarMigrationMissing(error)) {
                return { ok: true, data: { available: false, academicYears: [], semesters: [], activeSemester: null, updatedAt: null } };
            }
            if (error) return fail(error);

            const academicYears = yearResult.data || [];
            const yearsById = new Map(academicYears.map(year => [year.id, year]));
            const semesters = (semesterResult.data || []).map(row => {
                const year = yearsById.get(row.academic_year_id) || null;
                return {
                    id: row.id,
                    academicYearId: row.academic_year_id,
                    academicYear: year ? year.name : (row.school_year || ''),
                    name: row.name,
                    schoolYear: row.school_year || (year && year.name) || '',
                    startDate: row.start_date,
                    endDate: row.end_date,
                    finalsDate: row.finals_date || '',
                    totalWeeks: row.total_weeks || 15,
                    status: row.status,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                };
            });
            const activeId = settingResult.data && settingResult.data.active_semester_id;
            return {
                ok: true,
                data: {
                    available: true,
                    academicYears,
                    semesters,
                    activeSemester: semesters.find(semester => semester.id === activeId && semester.status === 'active') || null,
                    updatedAt: settingResult.data && settingResult.data.updated_at,
                },
            };
        } catch (error) {
            return fail(error);
        }
    },

    async upsertAcademicYear({ id = null, name, startDate, endDate }) {
        return this._rpc('admin_upsert_academic_year', { p_id: id, p_name: name, p_start_date: startDate, p_end_date: endDate });
    },

    async upsertSemester({ id = null, academicYearId, name, startDate, endDate }) {
        return this._rpc('admin_upsert_academic_semester', { p_id: id, p_academic_year_id: academicYearId, p_name: name, p_start_date: startDate, p_end_date: endDate });
    },

    async activateSemester(id) {
        return this._rpc('admin_activate_academic_semester', { p_id: id });
    },

    async archiveSemester(id) {
        return this._rpc('admin_archive_academic_semester', { p_id: id });
    },

    async _rpc(name, args) {
        try {
            const { error } = await getSupabase().rpc(name, args);
            return error ? fail(error) : { ok: true, data: {} };
        } catch (error) {
            return fail(error);
        }
    },
};
