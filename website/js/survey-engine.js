// Shared rules for ROAR surveys and polls: who sees a section or question.
// Used by the survey page (/survey/) and the Founders' console (builder and results).
//
// A "when" rule is plain data, so founders can edit it in the console:
//   { roles: ['pg1','pg2'] }                     only these respondent roles (from the "role" question)
//   { q: 'bond', eq: 'Yes, currently' }          only if an earlier answer equals a value
//   { q: 'considered_leaving', ne: 'Never' }     only if an earlier answer was given and is not this value
//   { q: 'experiences', anyNot: 'Never' }        only if any row of a grid question is not this value
//   { q: 'rotations', includes: 'Medical oncology' }  only if a multiple-choice answer includes a value
// Rules can combine roles with one answer condition.
window.ROAR_SURVEY_ENGINE = (function () {
  const RESIDENT = ['pg1', 'pg2', 'pg3'];
  const POSTPG = ['sr', 'fellow', 'consultant'];
  const SENIOR = ['senior'];

  // Audience presets offered in the builder
  const AUDIENCES = [
    ['', 'Everyone', null],
    ['inscope', 'Residents and ROs up to 6 years after PG', [...RESIDENT, ...POSTPG]],
    ['res', 'Residents only', RESIDENT],
    ['post', 'ROs up to 6 years after PG only', POSTPG],
    ['postsenior', 'ROs after PG (including seniors)', [...POSTPG, ...SENIOR]],
    ['senior', 'Senior ROs only', SENIOR],
  ];
  const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const audienceKey = c => {
    if (!c || !c.roles) return '';
    const hit = AUDIENCES.find(([, , r]) => r && same(r, c.roles));
    return hit ? hit[0] : 'custom';
  };
  const rolesFor = key => { const hit = AUDIENCES.find(a => a[0] === key); return hit && hit[2] ? [...hit[2]] : null; };

  const empty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);

  function cond(c, a) {
    if (!c) return true;
    if (typeof c === 'function') return !!c(a);          // older questionnaires
    a = a || {};
    if (c.roles && !c.roles.includes(a.role)) return false;
    if (c.q) {
      const v = a[c.q];
      if ('eq' in c && v !== c.eq) return false;
      if ('ne' in c && (empty(v) || v === c.ne)) return false;
      if ('anyNot' in c && !(v && typeof v === 'object' && Object.values(v).some(x => x && x !== c.anyNot))) return false;
      if ('includes' in c && !(Array.isArray(v) && v.includes(c.includes))) return false;
    }
    return true;
  }

  // Plain-English description of a rule, for the review copy and the builder
  function describe(c, survey) {
    if (!c) return '';
    if (typeof c === 'function') return 'Shown only to some respondents';
    const parts = [];
    if (c.roles) {
      const key = audienceKey(c);
      parts.push(key && key !== 'custom' ? AUDIENCES.find(a => a[0] === key)[1] : 'Some roles');
    }
    if (c.q) {
      const q = findQuestion(survey, c.q);
      const label = q ? `“${q.label.length > 60 ? q.label.slice(0, 60) + '…' : q.label}”` : c.q;
      if ('eq' in c) parts.push(`only if ${label} is “${c.eq}”`);
      else if ('ne' in c) parts.push(`only if ${label} is answered and not “${c.ne}”`);
      else if ('anyNot' in c) parts.push(`only if any row of ${label} is not “${c.anyNot}”`);
      else if ('includes' in c) parts.push(`only if ${label} includes “${c.includes}”`);
    }
    return parts.join(', ');
  }

  function findQuestion(survey, id) {
    for (const s of (survey && survey.sections) || []) for (const q of s.questions || []) if (q.id === id) return q;
    return null;
  }
  const allQuestions = survey => ((survey && survey.sections) || []).flatMap(s => s.questions || []);
  const hasRoleQuestion = survey => !!findQuestion(survey, 'role');

  // The standard opening question, so audience rules work in new surveys
  const ROLE_QUESTION = {
    id: 'role', type: 'single', required: true, label: 'Which best describes you today?', options: [
      ['pg1', 'PG resident, year 1'], ['pg2', 'PG resident, year 2'], ['pg3', 'PG resident, year 3'],
      ['sr', 'Senior resident / registrar'], ['fellow', 'Fellow (post-PG)'],
      ['consultant', 'Consultant or faculty, up to 6 years after PG'],
      ['senior', 'Radiation oncologist, more than 6 years after PG']],
  };

  const slugify = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);

  return { RESIDENT, POSTPG, SENIOR, AUDIENCES, audienceKey, rolesFor, cond, describe, findQuestion, allQuestions, hasRoleQuestion, ROLE_QUESTION, slugify };
})();
