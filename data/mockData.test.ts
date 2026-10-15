import { describe, it, expect } from 'vitest';
import { MOCK_JOBS } from './mockData';

describe('MOCK_JOBS shift invariant', () => {
  it('every scheduled job has at least one allocation', () => {
    const shiftless = MOCK_JOBS.filter(j => j.startDate && !(j.allocations?.length));
    expect(shiftless.map(j => j.id)).toEqual([]);
  });

  it('unscheduled jobs have none', () => {
    for (const j of MOCK_JOBS.filter(j => !j.startDate)) {
      expect(j.allocations ?? []).toHaveLength(0);
    }
  });

  it('Exterior Repaint: same-day different-time shifts sharing exactly one member', () => {
    const j = MOCK_JOBS.find(x => x.id === 'job-2')!;
    expect(j.allocations?.map(a => a.name)).toEqual(['Prep', 'Paint']);
    const [prep, paint] = j.allocations!;
    // Monday: Prep 8-12, Paint 13-17 - same day, different clock windows.
    expect(prep.startDate).toBe(paint.startDate);
    expect([prep.startTime, prep.endTime]).toEqual(['08:00', '12:00']);
    expect([paint.startTime, paint.endTime]).toEqual(['13:00', '17:00']);
    // Crews differ except one shared member (David, cm-3).
    const shared = prep.memberIds.filter(m => paint.memberIds.includes(m));
    expect(shared).toEqual(['cm-3']);
    expect(prep.memberIds).toEqual(['cm-3', 'cm-5']);   // David + Tom
    expect(paint.memberIds).toEqual(['cm-4', 'cm-3']);  // Sarah + David
    // Paint continues Tue-Wed mornings via per-day windows (Mon uses the 13-17 default).
    const overrides = Object.values(paint.dailyHours ?? {});
    expect(overrides).toHaveLength(2);
    for (const w of overrides) expect(w).toEqual({ startTime: '08:00', endTime: '12:00' });
  });

  it('Miller Exterior has Prep/Paint shifts with distinct windows', () => {
    const j = MOCK_JOBS.find(x => x.id === 'job-5')!;
    expect(j.allocations?.map(a => a.name)).toEqual(['Prep', 'Paint']);
    expect(j.allocations?.[0].endTime).toBe('17:00');
    expect(j.allocations?.[1].endTime).toBe('12:00');
  });

  it('Downtown Commercial runs two parallel task crews', () => {
    const j = MOCK_JOBS.find(x => x.id === 'job-6')!;
    expect(j.allocations?.map(a => a.name)).toEqual(['Spray Crew', 'Cut & Roll']);
    const [spray, cut] = j.allocations!;
    // Both crews work the same 1–5 PM window with DISJOINT members — parallel crews,
    // so nobody is double-booked and existing members keep their old afternoons.
    expect([spray.startTime, spray.endTime]).toEqual(['13:00', '17:00']);
    expect([cut.startTime, cut.endTime]).toEqual(['13:00', '17:00']);
    expect(spray.memberIds).toEqual(['cm-6', 'cm-5']);        // Robert + Tom (previously idle)
    expect(cut.memberIds).toEqual(['cm-1', 'cm-4', 'cm-2']);  // Mike, Sarah, Jessica
    expect(spray.memberIds.some(m => cut.memberIds.includes(m))).toBe(false);
    expect(j.crewMemberIds).toContain('cm-5');
  });
});
