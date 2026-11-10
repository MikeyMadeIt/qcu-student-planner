import { getSupabase } from '../core/supabase-client.js';

async function userId(sb) {
    const { data } = await sb.auth.getSession();
    return data?.session?.user?.id || null;
}
function fail(error) { throw new Error(error?.message || 'Database request failed'); }

export const AiQuizStore = {
    async saveQuiz(quiz, { topic = '', difficulty = '', fileName = null } = {}) {
        const sb = await getSupabase();
        const { data, error } = await sb.rpc('save_ai_quiz', {
            p_title: quiz.title, p_topic: topic, p_difficulty: difficulty,
            p_source_file_name: fileName, p_questions: quiz.questions,
        });
        if (error) fail(error);
        return data;
    },

    async saveAttempt(quizId, { correct, total, percent, answers }) {
        const sb = await getSupabase();
        const uid = await userId(sb);
        const { error } = await sb.from('ai_quiz_attempts').insert({
            quiz_id: quizId, user_id: uid, correct_count: correct,
            total_questions: total, percent, answers,
        });
        if (error) fail(error);
    },

    async listQuizzes() {
        const sb = await getSupabase();
        const { data, error } = await sb.from('ai_quizzes')
            .select('id,title,topic,difficulty,question_count,created_at,ai_quiz_attempts(percent,created_at)')
            .order('created_at', { ascending: false }).limit(50);
        if (error) fail(error);
        return (data || []).map(q => {
            const a = q.ai_quiz_attempts || [];
            return { ...q, attempts: a.length, bestPercent: a.length ? Math.max(...a.map(x => x.percent)) : null };
        });
    },

    async getQuiz(id) {
        const sb = await getSupabase();
        const [qz, qs] = await Promise.all([
            sb.from('ai_quizzes').select('id,title').eq('id', id).single(),
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
        const { error } = await sb.from('ai_quizzes').delete().eq('id', id);
        if (error) fail(error);
    },
};