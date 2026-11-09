import { getSupabase } from '../core/supabase-client.js';

function fail(error) { throw new Error(error?.message || 'Database request failed'); }

export const AiFlashcardStore = {
    /** set = { title, cards:[{front,back}] } -> new deck id */
    async saveDeck(set, { topic = '', fileName = null } = {}) {
        const sb = await getSupabase();
        const { data, error } = await sb.rpc('save_ai_flashcard_deck', {
            p_title: set.title, p_topic: topic,
            p_source_file_name: fileName, p_cards: set.cards,
        });
        if (error) fail(error);
        return data;
    },

    async listDecks() {
        const sb = await getSupabase();
        const { data, error } = await sb.from('ai_flashcard_decks')
            .select('id,title,topic,card_count,created_at')
            .order('created_at', { ascending: false }).limit(50);
        if (error) fail(error);
        return data || [];
    },

    /** Returns { id, title, cards:[{front,back}] } - same shape afmValidateSet produces. */
    async getDeck(id) {
        const sb = await getSupabase();
        const [dk, cs] = await Promise.all([
            sb.from('ai_flashcard_decks').select('id,title').eq('id', id).single(),
            sb.from('ai_flashcards').select('front,back').eq('deck_id', id).order('position', { ascending: true }),
        ]);
        if (dk.error) fail(dk.error);
        if (cs.error) fail(cs.error);
        return { id: dk.data.id, title: dk.data.title, cards: cs.data.map(r => ({ front: r.front, back: r.back })) };
    },

    async deleteDeck(id) {
        const sb = await getSupabase();
        const { error } = await sb.from('ai_flashcard_decks').delete().eq('id', id);
        if (error) fail(error);
    },
};