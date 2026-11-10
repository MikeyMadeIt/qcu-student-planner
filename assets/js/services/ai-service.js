// Shared AI backend client (ES module).

import { getSupabase } from '../core/supabase-client.js';

const AI_EDGE_FUNCTION_NAME = 'ai-study';
const AI_REQUEST_TIMEOUT_MS = 45000; /* generous — Gemini generation can take a while */
const AI_PROMPT_CHAR_LIMIT = 12000;  /* matches the backend's documented prompt limit */

function fail(message) {
    return { ok: false, message };
}

function ok(data) {
    return { ok: true, data };
}

function timeoutAfter(ms) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('__ai_timeout__')), ms);
    });
}

// Calls the "ai-study" Edge Function.
async function callAiBackend({ feature, prompt, questionCount, difficulty, file }) {
    let supabase;
    try {
        supabase = getSupabase();
    } catch (error) {
        return fail('The app could not connect to its backend. Please reload the page.');
    }

    let sessionData;
    try {
        ({ data: sessionData } = await supabase.auth.getSession());
    } catch (error) {
        return fail('Could not verify your session. Please reload the page and sign in again.');
    }
    if (!sessionData || !sessionData.session) {
        return fail('Your session has expired. Please sign in again to use AI Tools.');
    }

    const trimmedPrompt = (prompt || '').slice(0, AI_PROMPT_CHAR_LIMIT);
    if (!trimmedPrompt.trim() && !file) {
        return fail('Please enter a message or attach a file before sending.');
    }

    const body = { feature, prompt: trimmedPrompt };
    if (questionCount != null) body.questionCount = questionCount;
    if (difficulty) body.difficulty = difficulty;
    if (file) {
        body.file = {
            name: file.fileName,
            mimeType: file.mimeType,
            data: file.base64,
        };
    }

    let invokeResult;
    try {
        invokeResult = await Promise.race([
            supabase.functions.invoke(AI_EDGE_FUNCTION_NAME, { body }),
            timeoutAfter(AI_REQUEST_TIMEOUT_MS),
        ]);
    } catch (error) {
        if (error && error.message === '__ai_timeout__')
            return fail('The AI is taking too long to respond. Please try again in a moment.');
        if (typeof navigator !== 'undefined' && navigator.onLine === false)
            return fail('You appear to be offline. Check your connection and try again.');
        return fail('Could not reach the AI service. Check your connection and try again.');
    }

    const { data, error } = invokeResult;

    if (error) {
        return fail(await describeInvokeError(error));
    }

    if (!data) return fail('The AI service returned an empty response. Please try again.');

    if (data.success === false) {
        return fail(typeof data.error === 'string' && data.error ? data.error : 'The AI could not complete that request. Please try again.');
    }

    if (!('result' in data)) {
        return fail('The AI service returned a response in an unexpected format. Please try again.');
    }

    return ok(data.result);
}

// Turns a supabase-js FunctionsError into a short, student-facing message —
async function describeInvokeError(error) {
    const status = error && error.context && error.context.status;

    if (status === 401 || status === 403)
        return 'Your session has expired. Please sign in again to use AI Tools.';
    if (status === 413)
        return 'That file is too large for the AI to process. Attachments must be 8 MB or smaller.';
    if (status === 429)
        return 'The AI service is busy right now. Please wait a moment and try again.';
    if (typeof status === 'number' && status >= 500)
        return 'The AI service is temporarily unavailable. Please try again shortly.';

    let message = '';
    try {
        if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && typeof body.error === 'string') message = body.error;
        }
    } catch { /* ignore — fall back below */ }

    if (!message) message = (error && error.message) || '';
    if (/not\s*found|404/i.test(message))
        return 'The AI service could not be found. Please contact support if this continues.';
    if (!message || /failed to fetch|networkerror/i.test(message))
        return 'Could not reach the AI service. Check your connection and try again.';

    return message;
}

export const AiService = {
    generateQuiz({ topic, notes, questionCount, difficulty, file }) {
        return callAiBackend({
            feature: 'quiz',
            prompt: buildPromptFromTopicAndNotes(topic, notes, file),
            questionCount,
            difficulty,
            file,
        });
    },

    generateFlashcards({ topic, notes, file }) {
        return callAiBackend({
            feature: 'flashcards',
            prompt: buildPromptFromTopicAndNotes(topic, notes, file),
            file,
        });
    },

    sendStudyAssistantMessage({ message, history, file }) {
        const prompt = buildAssistantPrompt(message, history);
        return callAiBackend({ feature: 'assistant', prompt, file });
    },
};

function buildPromptFromTopicAndNotes(topic, notes, file) {
    const parts = [];
    if (topic && topic.trim()) parts.push(`Topic: ${topic.trim()}`);
    if (notes && notes.trim()) parts.push(notes.trim());
    if (!parts.length && file) parts.push('Use the attached file as the source material. Generate relevant study content covering its key concepts.');
    return parts.join('\n\n');
}

// Builds "<trimmed prior turns>\n\nStudent: <message>" and trims from the
function buildAssistantPrompt(message, history) {
    const currentLine = `Student: ${(message || '').trim()}`;
    const reserve = AI_PROMPT_CHAR_LIMIT - currentLine.length - 64; /* headroom for framing text */
    if (reserve <= 0) return currentLine;

    const turns = Array.isArray(history) ? history : [];
    const lines = [];
    let used = 0;
    for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        if (!turn || typeof turn.content !== 'string') continue;
        const speaker = turn.role === 'assistant' ? 'Assistant' : 'Student';
        const line = `${speaker}: ${turn.content.trim()}`;
        if (used + line.length + 1 > reserve) break;
        lines.unshift(line);
        used += line.length + 1;
    }

    if (!lines.length) return currentLine;
    return `Previous conversation:\n${lines.join('\n')}\n\n${currentLine}`;
}
