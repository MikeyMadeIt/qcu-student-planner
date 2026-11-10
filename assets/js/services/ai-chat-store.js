import { getSupabase } from '../core/supabase-client.js';

function fail(error) { throw new Error(error?.message || 'Database request failed'); }

export const AiChatStore = {
    async saveTurn(conversationId, { title, userContent, userFileName = null, assistantContent }) {
        const sb = await getSupabase();
        const { data, error } = await sb.rpc('save_ai_chat_turn', {
            p_conversation_id: conversationId || null,
            p_title: title || '',
            p_user_content: userContent,
            p_user_file_name: userFileName,
            p_assistant_content: assistantContent,
        });
        if (error) fail(error);
        return data;
    },

    async listConversations() {
        const sb = await getSupabase();
        const { data, error } = await sb.from('ai_chat_conversations')
            .select('id,title,updated_at')
            .order('updated_at', { ascending: false }).limit(50);
        if (error) fail(error);
        return data || [];
    },

    async getConversation(id) {
        const sb = await getSupabase();
        const [cv, ms] = await Promise.all([
            sb.from('ai_chat_conversations').select('id,title').eq('id', id).single(),
            sb.from('ai_chat_messages').select('role,content,file_name')
              .eq('conversation_id', id).order('position', { ascending: true }),
        ]);
        if (cv.error) fail(cv.error);
        if (ms.error) fail(ms.error);
        return {
            id: cv.data.id, title: cv.data.title,
            messages: ms.data.map(m => ({ role: m.role, content: m.content, fileName: m.file_name || null })),
        };
    },

    async deleteConversation(id) {
        const sb = await getSupabase();
        const { error } = await sb.from('ai_chat_conversations').delete().eq('id', id);
        if (error) fail(error);
    },
};