// Attendance statistics (pure logic, no DOM)

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

// Shared attendance counting. Used by the Attendance page, Dashboard and Schedule so the
// same records always produce the same numbers.
// "Attended" = Present, Late or Excused. "No Classes" days are never counted.

function summarizeAttendance(records) {
    var s = { present: 0, late: 0, excused: 0, absent: 0, noClass: 0 };
    (records || []).forEach(function (r) {
        if (r.status === 'Present') s.present++;
        else if (r.status === 'Late') s.late++;
        else if (r.status === 'Excused') s.excused++;
        else if (r.status === 'Absent') s.absent++;
        else if (r.status === 'No Classes') s.noClass++;
    });
    s.counted = s.present + s.late + s.excused + s.absent;
    s.attended = s.present + s.late + s.excused;
    s.rate = s.counted > 0 ? Math.round(s.attended / s.counted * 100) : null;
    return s;
}

// Attendance records of the given semester that belong to a subject which still exists and is
// not archived. Records left behind by deleted subjects (or hidden archived ones) are ignored,
// so overall figures always equal the sum of the per-subject figures.
function getLiveSemesterAttendance(semId) {
    var ids = {};
    DB.getSubjects().forEach(function (s) {
        if (s.semesterId === semId && !s.archived)
            ids[s.id] = true;
    });
    return DB.getAttendance().filter(function (r) { return r.semesterId === semId && ids[r.subjectId]; });
}