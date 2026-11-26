import { getSupabase } from '../core/supabase-client.js';

function fail(error) { throw new Error(error?.message || 'Database request failed'); }
const PENDING_DECK_KEY = 'sp_pending_deck_semester';
function fingerprint(value) {
    const text = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16);
}
async function assignSemester(sb, id, uid, semesterId) {
    const { error } = await sb.from('ai_flashcard_decks').update({ semester_id: semesterId }).eq('id', id).eq('user_id', uid);
    if (error) fail(error);
}

export const AiFlashcardStore = {
    async saveDeck(set, { topic = '', fileName = null } = {}) {
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('Set an active or previous semester before saving a deck.');
        const sb = await getSupabase();
        const { data: sessionData } = await sb.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        const stamp = fingerprint({ set, topic, fileName });
        let pending = null;
        try { pending = JSON.parse(localStorage.getItem(PENDING_DECK_KEY) || 'null'); } catch (e) { /* ignore */ }
        if (pending && pending.userId !== uid) { localStorage.removeItem(PENDING_DECK_KEY); pending = null; }
        if (pending) {
            await assignSemester(sb, pending.id, uid, pending.semesterId);
            localStorage.removeItem(PENDING_DECK_KEY);
            if (pending.fingerprint === stamp) return pending.id;
        }
        const { data, error } = await sb.rpc('save_ai_flashcard_deck', {
            p_title: set.title, p_topic: topic,
            p_source_file_name: fileName, p_cards: set.cards,
        });
        if (error) fail(error);
        localStorage.setItem(PENDING_DECK_KEY, JSON.stringify({ id: data, userId: uid, semesterId, fingerprint: stamp }));
        await assignSemester(sb, data, uid, semesterId);
        localStorage.removeItem(PENDING_DECK_KEY);
        return data;
    },

    async listDecks() {
        const sb = await getSupabase();
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) return [];
        const { data, error } = await sb.from('ai_flashcard_decks')
            .select('id,title,topic,card_count,created_at')
            .eq('semester_id', semesterId)
            .order('created_at', { ascending: false }).limit(50);
        if (error) fail(error);
        return data || [];
    },

    async getDeck(id) {
        const sb = await getSupabase();
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('No semester is selected.');
        const [dk, cs] = await Promise.all([
            sb.from('ai_flashcard_decks').select('id,title').eq('id', id).eq('semester_id', semesterId).single(),
            sb.from('ai_flashcards').select('front,back').eq('deck_id', id).order('position', { ascending: true }),
        ]);
        if (dk.error) fail(dk.error);
        if (cs.error) fail(cs.error);
        return { id: dk.data.id, title: dk.data.title, cards: cs.data.map(r => ({ front: r.front, back: r.back })) };
    },

    async deleteDeck(id) {
        const sb = await getSupabase();
        const semesterId = typeof DB !== 'undefined' ? DB.getActiveSemesterId() : null;
        if (!semesterId) throw new Error('No semester is selected.');
        const { error } = await sb.from('ai_flashcard_decks').delete().eq('id', id).eq('semester_id', semesterId);
        if (error) fail(error);
    },
};
