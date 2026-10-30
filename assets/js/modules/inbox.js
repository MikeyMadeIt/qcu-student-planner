function initInbox() {
    const search = document.getElementById('inboxSearch');
    const state = document.getElementById('inboxListState');
    search.addEventListener('input', () => {
        const hasSearch = Boolean(search.value.trim());
        state.querySelector('strong').textContent = hasSearch ? 'No matching conversations' : 'No conversations';
        state.querySelector('span').textContent = hasSearch
            ? 'There are no conversations to match this search.'
            : 'When messaging is connected, your conversations will appear here.';
    });
}
