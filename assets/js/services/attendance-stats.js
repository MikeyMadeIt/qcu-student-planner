// Attendance statistics (pure logic, no DOM)

function getConsecutiveAbsences(subjectId, records) {
    const subRecs = records
        .filter(r => r.subjectId === subjectId && r.status !== 'No Classes')
        .sort((a, b) => a.date.localeCompare(b.date));
    if (!subRecs.length)
        return 0;
    let maxStreak = 0, curStreak = 0;
    for (const r of subRecs) {
        if (r.status === 'Absent') {
            curStreak++;
            maxStreak = Math.max(maxStreak, curStreak);
        }
        else {
            curStreak = 0;
        }
    }
    return maxStreak;
}

function getCurrentConsecutiveAbsences(subjectId, records) {
    const subRecs = records
        .filter(r => r.subjectId === subjectId && r.status !== 'No Classes')
        .sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    for (const r of subRecs) {
        if (r.status === 'Absent')
            streak++;
        else
            break;
    }
    return streak;
}
