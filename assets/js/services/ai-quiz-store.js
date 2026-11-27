import { getSupabase } from '../core/supabase-client.js';

async function userId(sb) {
    const { data } = await sb.auth.getSession();
    return data?.session?.user?.id || null;
}
function fail(error) { throw new Error(error?.message || 'Database request failed'); }
const PENDING_QUIZ_KEY = 'sp_pending_quiz_semester';
function fingerprint(value) {
    const text = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16);
}
async function assignSemester(sb, id, uid, semesterId) {
    const { error } = await sb.from('ai_quizzes').update({ semester_id: semesterId }).eq('id', id).eq('user_id', uid);
    if (error) fail(error);
}

export const AiQuizStore = {
    async saveQuiz(quiz, { topic = '', difficulty = '', fileName = null } = {}) {
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('Set an active or previous semester before saving a quiz.');
        const sb = await getSupabase();
        const uid = await userId(sb);
        const stamp = fingerprint({ quiz, topic, difficulty, fileName });
        let pending = null;
        try { pending = JSON.parse(localStorage.getItem(PENDING_QUIZ_KEY) || 'null'); } catch (e) { /* ignore */ }
        if (pending && pending.userId !== uid) { localStorage.removeItem(PENDING_QUIZ_KEY); pending = null; }
        if (pending) {
            await assignSemester(sb, pending.id, uid, pending.semesterId);
            localStorage.removeItem(PENDING_QUIZ_KEY);
            if (pending.fingerprint === stamp) return pending.id;
        }
        const { data, error } = await sb.rpc('save_ai_quiz', {
            p_title: quiz.title, p_topic: topic, p_difficulty: difficulty,
            p_source_file_name: fileName, p_questions: quiz.questions,
        });
        if (error) fail(error);
        localStorage.setItem(PENDING_QUIZ_KEY, JSON.stringify({ id: data, userId: uid, semesterId, fingerprint: stamp }));
        await assignSemester(sb, data, uid, semesterId);
        localStorage.removeItem(PENDING_QUIZ_KEY);
        return data;
    },

    async saveAttempt(quizId, { correct, total, percent, answers }) {
        const sb = await getSupabase();
        const uid = await userId(sb);
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('Set an active or previous semester before saving a quiz attempt.');
        const { error } = await sb.from('ai_quiz_attempts').insert({
            quiz_id: quizId, user_id: uid, correct_count: correct,
            total_questions: total, percent, answers, semester_id: semesterId,
        });
        if (error) fail(error);
    },

    async listQuizzes() {
        const sb = await getSupabase();
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) return [];
        const { data, error } = await sb.from('ai_quizzes')
            .select('id,title,topic,difficulty,question_count,created_at,ai_quiz_attempts(percent,created_at)')
            .eq('semester_id', semesterId)
            .order('created_at', { ascending: false }).limit(50);
        if (error) fail(error);
        return (data || []).map(q => {
            const a = q.ai_quiz_attempts || [];
            return { ...q, attempts: a.length, bestPercent: a.length ? Math.max(...a.map(x => x.percent)) : null };
        });
    },

    async getQuiz(id) {
        const sb = await getSupabase();
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('No semester is selected.');
        const [qz, qs] = await Promise.all([
            sb.from('ai_quizzes').select('id,title').eq('id', id).eq('semester_id', semesterId).single(),
            sb.from('ai_quiz_questions').select('question,choices,correct_index,explanation')
              .eq('quiz_id', id).order('position', { ascending: true }),
        ]);
        if (qz.error) fail(qz.error);
        if (qs.error) fail(qs.error);
        return {
            id: qz.data.id, title: qz.data.title,
            questions: qs.data.map(r => ({
                question: r.question, choices: r.choices,
                correctIndex: r.correct_index, explanation: r.explanation || '',
            })),
        };
    },

    async deleteQuiz(id) {
        const sb = await getSupabase();
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('No semester is selected.');
        const { error } = await sb.from('ai_quizzes').delete().eq('id', id).eq('semester_id', semesterId);
        if (error) fail(error);
    },
};
