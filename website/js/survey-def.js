// ROAR National Survey of Radiation Oncologists in India: the questionnaire.
// DRAFT for the founders to review (owner: Additional Secretary – Social Media & Surveys).
// This one file drives the survey page (/survey/), its printable review (/survey/?review=1)
// and the results in the Founders' console. Change questions here; bump VERSION when you do.
//
// Question types: single, multi (max = most choices), select (dropdown), scale (labels),
// matrix (rows x cols, one choice per row), nps (0-10), text.
// "when" decides who sees a section or question, from the answers so far.
(function () {
  // Display rules are plain data (see js/survey-engine.js), so they can be edited in the console
  const RESIDENT = ['pg1', 'pg2', 'pg3'];
  const POSTPG = ['sr', 'fellow', 'consultant'];
  const IN_SCOPE = { roles: [...RESIDENT, ...POSTPG] };   // residents and radiation oncologists up to 6 years after PG
  const RES_ONLY = { roles: RESIDENT };
  const POST_ONLY = { roles: POSTPG };
  const POST_OR_SENIOR = { roles: [...POSTPG, 'senior'] };
  const SENIOR_ONLY = { roles: ['senior'] };

  const AGREE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
  const FREQ5 = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];

  window.ROAR_SURVEY = {
    id: 'national-survey-2027',
    version: '0.1-draft',
    title: 'National Survey of Radiation Oncologists in India',
    minutes: 15,
    intro: 'ROAR is asking every radiation oncology resident and young radiation oncologist in India about training, working conditions, wellbeing and careers. The results will be published as the first State of Young Radiation Oncologists in India report, and will shape ROAR\'s programmes and advocacy.',
    helpline: 'If any question brings up something difficult, you can call Tele-MANAS on 14416 (or 1-800-891-4416), India\'s free 24-hour mental health helpline.',
    sections: [
      {
        id: 'about', title: 'About you',
        intro: 'We don\'t ask for your name, institution or contact details. Broad groups are used so that no one can be identified.',
        questions: [
          { id: 'role', type: 'single', required: true, label: 'Which best describes you today?', options: [
            ['pg1', 'PG resident, year 1'], ['pg2', 'PG resident, year 2'], ['pg3', 'PG resident, year 3'],
            ['sr', 'Senior resident / registrar'], ['fellow', 'Fellow (post-PG)'],
            ['consultant', 'Consultant or faculty, up to 6 years after PG'],
            ['senior', 'Radiation oncologist, more than 6 years after PG']] },
          { id: 'course', type: 'single', required: true, label: 'Your PG qualification (completed or in progress)', options: ['MD', 'DNB', 'Equivalent abroad', 'Other'] },
          { id: 'since_pg', type: 'single', label: 'How long ago did you complete PG?', when: POST_OR_SENIOR,
            options: ['Less than 1 year', '1–2 years', '3–4 years', '5–6 years', 'More than 6 years'] },
          { id: 'age', type: 'single', label: 'Age', options: ['Under 26', '26–30', '31–35', '36–40', 'Over 40', 'Prefer not to say'] },
          { id: 'gender', type: 'single', label: 'Gender', options: ['Woman', 'Man', 'Non-binary or another identity', 'Prefer not to say'] },
          { id: 'region', type: 'single', required: true, label: 'Region where you work or train', options: ['North', 'South', 'East', 'West', 'Central', 'North-East'] },
          { id: 'inst_type', type: 'single', required: true, label: 'Type of institution', options: [
            'Government medical college', 'AIIMS or other Institute of National Importance', 'Regional Cancer Centre or government cancer institute',
            'Private or deemed medical college', 'Corporate or private hospital (including DNB)', 'Standalone radiotherapy centre', 'Other'] },
          { id: 'dept_residents', type: 'single', label: 'Number of PG residents in your department (all years)', options: ['1–3', '4–6', '7–12', 'More than 12', 'Don\'t know'] },
          { id: 'machines', type: 'single', label: 'Treatment machines in your department', options: ['Cobalt only', '1 linear accelerator', '2–3 linear accelerators', '4 or more linear accelerators', 'Don\'t know'] },
        ],
      },
      {
        id: 'training', title: 'Training and clinical exposure', when: IN_SCOPE,
        intro: 'If you have finished PG, answer about your PG training.',
        questions: [
          { id: 'exposure', type: 'matrix', label: 'During PG, what was your experience of each of these?',
            rows: ['2D / conventional planning', '3D conformal radiotherapy', 'IMRT / VMAT', 'IGRT (CBCT or kV imaging)', 'SRS / SBRT',
              'Brachytherapy: intracavitary (gynaecological)', 'Brachytherapy: interstitial', 'Electron therapy', 'Paediatric radiotherapy',
              'Palliative radiotherapy', 'Re-irradiation'],
            cols: ['Not available', 'Observed only', 'Did it under supervision', 'Did it independently'] },
          { id: 'contouring_who', type: 'single', label: 'In your department, who usually contours targets and organs at risk?', options: [
            'Residents contour, consultants review', 'Consultants contour, residents observe', 'Mostly physicists or dosimetrists', 'It varies'] },
          { id: 'contour_feedback', type: 'scale', label: 'How often do you get feedback on your contours?', scale: ['Never', 'Rarely', 'Sometimes', 'Often', 'Every case'] },
          { id: 'plan_review', type: 'scale', label: 'How often are you involved in evaluating treatment plans with physicists?', scale: FREQ5 },
          { id: 'teaching', type: 'matrix', label: 'How often does your department hold these?',
            rows: ['Seminars or lectures', 'Journal club', 'Tumour board / multidisciplinary meeting', 'Case presentations', 'Medical physics teaching', 'Radiobiology teaching'],
            cols: ['Never', 'Less than monthly', 'Monthly', 'Weekly or more'] },
          { id: 'rotations', type: 'multi', label: 'Which rotations did (or do) you have during PG?', options: [
            'Medical oncology', 'Surgical oncology', 'Radiology / imaging', 'Pathology', 'Nuclear medicine', 'Palliative care', 'Medical physics', 'None of these'] },
          { id: 'study_time', type: 'single', label: 'Do you get protected time for study?', options: ['Yes, regularly', 'Sometimes', 'No'] },
          { id: 'practice_match', type: 'scale', label: 'Does your department\'s day-to-day practice match what you are taught (guidelines and curriculum)?', scale: ['Rarely', 'Sometimes', 'Mostly', 'Always'] },
          { id: 'non_ro_work', type: 'scale', label: 'How often are you asked to do work unrelated to your radiation oncology training?', help: 'For example, covering other departments\' wards, or administrative work.', scale: ['Never', 'Monthly', 'Weekly', 'Most days'] },
          { id: 'training_quality', type: 'scale', required: true, label: 'Overall, how would you rate the quality of your training?', scale: ['Very poor', 'Poor', 'Fair', 'Good', 'Excellent'] },
          { id: 'confidence', type: 'scale', label: 'How confident do you feel (or expect to feel at the end of PG) about practising radiation oncology independently?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Completely'] },
          { id: 'gaps', type: 'multi', max: 3, label: 'What are the biggest gaps in your training? Choose up to 3.', options: [
            'Modern techniques (IMRT, IGRT, SBRT)', 'Brachytherapy', 'Contouring teaching', 'Treatment planning and physics', 'Structured teaching programme',
            'Patient volume or case mix', 'Supervision and feedback', 'Research guidance', 'Exam preparation', 'No major gaps'] },
          { id: 'observership', type: 'single', label: 'Would you do an observership at another Indian centre to fill these gaps?', options: ['Yes, definitely', 'Maybe', 'No'] },
        ],
      },
      {
        id: 'hours', title: 'Working hours and duties', when: IN_SCOPE,
        intro: 'Think about a typical month in your current post.',
        questions: [
          { id: 'hours_week', type: 'single', required: true, label: 'On average, how many hours do you work per week, including on-call?', options: ['Under 48', '48–60', '61–72', '73–84', 'More than 84'] },
          { id: 'longest_duty', type: 'single', label: 'Your longest continuous duty in the last month', options: ['Up to 12 hours', '13–24 hours', '25–36 hours', 'More than 36 hours'] },
          { id: 'rest_after', type: 'single', label: 'After a long duty, do you get a rest period?', options: ['Usually', 'Sometimes', 'Never', 'I don\'t do long duties'] },
          { id: 'days_off', type: 'single', label: 'On average, how many full days off do you get per week?', options: ['None', 'Less than one', 'One', 'Two or more'] },
          { id: 'nights', type: 'single', label: 'Night on-calls per month', options: ['None', '1–4', '5–8', '9–12', 'More than 12'] },
          { id: 'leave', type: 'single', label: 'In the last 12 months, could you take the leave you are entitled to?', options: ['All of it', 'Most of it', 'Some of it', 'None of it', 'Not applicable'] },
          { id: 'duty_logs', type: 'single', label: 'Are your duty hours recorded?', options: ['Yes, accurately', 'Yes, but not accurately', 'No', 'Don\'t know'] },
        ],
      },
      {
        id: 'pay', title: 'Stipend, pay and contracts', when: IN_SCOPE,
        intro: 'These answers feed ROAR\'s national Stipend Index and Senior Resident Pay Benchmark. Ranges are used so no one can be identified.',
        questions: [
          { id: 'stipend', type: 'single', when: RES_ONLY, label: 'Your monthly stipend before deductions', options: [
            'Under ₹50,000', '₹50,000–75,000', '₹75,000–1,00,000', '₹1,00,000–1,25,000', '₹1,25,000–1,50,000', 'Over ₹1,50,000', 'Prefer not to say'] },
          { id: 'stipend_timely', type: 'single', when: RES_ONLY, label: 'In the last 12 months, your stipend was paid…', options: [
            'Always on time', 'Late once or twice', 'Often late', 'Unpaid for 3 months or more'] },
          { id: 'salary', type: 'single', when: POST_ONLY, label: 'Your monthly salary before deductions', options: [
            'Under ₹75,000', '₹75,000–1,00,000', '₹1,00,000–1,50,000', '₹1,50,000–2,00,000', '₹2,00,000–3,00,000', 'Over ₹3,00,000', 'Prefer not to say'] },
          { id: 'bond', type: 'single', label: 'Are you bound by a service bond?', options: ['Yes, currently', 'I completed one', 'No'] },
          { id: 'bond_amount', type: 'single', when: { q: 'bond', eq: 'Yes, currently' }, label: 'Penalty for breaking the bond', options: [
            'Under ₹10 lakh', '₹10–25 lakh', '₹25–50 lakh', 'Over ₹50 lakh', 'Not a money bond', 'Don\'t know'] },
          { id: 'pay_fair', type: 'scale', label: 'My pay is fair for the work I do.', scale: AGREE },
          { id: 'contract_issues', type: 'multi', when: POST_ONLY, label: 'In your current post, have you faced any of these?', options: [
            'No written contract', 'Unclear duties', 'Long notice period', 'Non-compete clause', 'Pay cut or withheld pay', 'Pressure from targets or incentives', 'None of these'] },
        ],
      },
      {
        id: 'environment', title: 'Work environment and dignity', when: IN_SCOPE,
        intro: 'Every question in this section is optional. Your answers help ROAR understand patterns across India, never individual cases.',
        questions: [
          { id: 'respect', type: 'matrix', label: 'I am treated with respect by…',
            rows: ['Consultants and faculty', 'Fellow residents', 'Nursing and technical staff', 'Hospital administration', 'Other departments'], cols: AGREE },
          { id: 'experiences', type: 'matrix', label: 'In the last 12 months at work, how often have you experienced…',
            rows: ['Being shouted at or humiliated', 'Bullying or intimidation', 'Sexual harassment', 'Discrimination because of gender',
              'Discrimination because of caste', 'Discrimination because of religion', 'Discrimination because of region or language',
              'Discrimination because of where you trained', 'Violence or threats from patients or relatives'],
            cols: ['Never', 'Once or twice', 'Several times', 'Often'] },
          { id: 'reported', type: 'single', label: 'If you experienced any of these, did you report it?', when: { q: 'experiences', anyNot: 'Never' },
            options: ['Yes, and it was resolved', 'Yes, but it was not resolved', 'No'] },
          { id: 'why_not', type: 'multi', when: { q: 'reported', eq: 'No' }, label: 'Why not?', options: [
            'Fear of consequences', 'Didn\'t know how', 'No mechanism to report', 'Thought nothing would change', 'Didn\'t think it was serious enough', 'Another reason'] },
          { id: 'mechanisms', type: 'multi', label: 'As far as you know, does your institution have…', options: [
            'An Internal Committee under the POSH Act', 'An anti-ragging committee', 'A grievance cell for residents', 'I don\'t know of any'] },
          { id: 'valued', type: 'scale', label: 'Radiation oncology is valued as a specialty in my institution.', scale: AGREE },
        ],
      },
      {
        id: 'wellbeing', title: 'Wellbeing and safety', when: IN_SCOPE,
        intro: 'These questions are optional. They use short, widely used screening items, and are not a diagnosis.',
        questions: [
          { id: 'burnout', type: 'single', label: 'Overall, based on your own definition of burnout, how would you rate your level of burnout?', options: [
            'I enjoy my work and have no symptoms of burnout', 'Occasionally I am under stress, but I don\'t feel burned out',
            'I am definitely burning out and have one or more symptoms, such as physical and emotional exhaustion',
            'The symptoms of burnout won\'t go away; I think about frustration at work a lot', 'I feel completely burned out and may need help'] },
          { id: 'mood', type: 'matrix', label: 'Over the last 2 weeks, how often have you been bothered by…',
            rows: ['Little interest or pleasure in doing things', 'Feeling down, depressed or hopeless'],
            cols: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
          { id: 'sleep', type: 'single', label: 'Average sleep on a working day', options: ['Under 5 hours', '5–6 hours', '6–7 hours', 'More than 7 hours'] },
          { id: 'support_known', type: 'scale', label: 'If I needed support for my mental health, I know where to get it.', scale: AGREE },
          { id: 'dosimeter', type: 'single', label: 'Are you issued a personal radiation dosimeter (TLD or OSL badge)?', options: ['Yes, and it is read regularly', 'Yes, but it is rarely read', 'No', 'Not sure'] },
          { id: 'safety_training', type: 'single', label: 'Have you had radiation safety training in your current post?', options: ['Yes', 'No', 'Not sure'] },
          { id: 'night_safety', type: 'scale', label: 'I feel safe at work during night duties.', scale: AGREE },
          { id: 'facilities', type: 'multi', label: 'Which of these are available to you during duties?', options: [
            'A duty room to rest', 'Clean washrooms', 'Food at night', 'Safe transport at night', 'Drinking water', 'None of these'] },
        ],
      },
      {
        id: 'research', title: 'Research and academics', when: IN_SCOPE,
        questions: [
          { id: 'thesis_guidance', type: 'scale', when: RES_ONLY, label: 'How good is the guidance for your thesis?', scale: ['Very poor', 'Poor', 'Fair', 'Good', 'Excellent'] },
          { id: 'publications', type: 'single', label: 'Peer-reviewed publications so far', options: ['None', '1–2', '3–5', 'More than 5'] },
          { id: 'barriers', type: 'multi', label: 'What gets in the way of research for you?', options: [
            'Time', 'Guidance or mentorship', 'Statistics support', 'Funding', 'Ethics approval delays', 'Access to journals', 'Access to data', 'Nothing major'] },
          { id: 'conferences', type: 'single', label: 'Does your institution support conference attendance?', options: ['Funds it and gives leave', 'Gives leave only', 'Neither'] },
          { id: 'multicentre', type: 'single', label: 'Would you join a ROAR multi-centre resident research project?', options: ['Yes', 'Maybe', 'No'] },
        ],
      },
      {
        id: 'career', title: 'Career and the future', when: IN_SCOPE,
        questions: [
          { id: 'plans', type: 'single', label: 'What do you plan to do over the next 3 years?', options: [
            'Senior residency in India', 'Fellowship in India', 'Fellowship abroad', 'Consultant in a government hospital', 'Consultant in a private or corporate hospital',
            'Academic faculty post', 'Practise abroad', 'Leave clinical radiation oncology', 'Undecided'] },
          { id: 'job_confidence', type: 'scale', label: 'I am confident of finding a good post after training.', scale: AGREE },
          { id: 'mentor', type: 'single', label: 'Do you have a mentor?', options: ['Yes, in my department', 'Yes, outside my department', 'No, but I would like one', 'No, and I don\'t need one'] },
          { id: 'choose_again', type: 'single', label: 'Knowing what you know now, would you choose radiation oncology again?', options: ['Definitely', 'Probably', 'Not sure', 'Probably not', 'No'] },
          { id: 'considered_leaving', type: 'single', label: 'Have you seriously considered leaving the specialty?', options: ['Never', 'Once or twice', 'Often'] },
          { id: 'leaving_why', type: 'multi', when: { q: 'considered_leaving', ne: 'Never' }, label: 'Why?', options: [
            'Training quality', 'Working conditions', 'Pay', 'Job prospects', 'Treatment at work', 'Wellbeing', 'Interest in another field', 'Another reason'] },
          { id: 'recommend', type: 'nps', label: 'How likely are you to recommend your department\'s training to a junior colleague?', low: 'Not at all likely', high: 'Extremely likely' },
        ],
      },
      {
        id: 'senior_view', title: 'Your perspective as a senior radiation oncologist', when: SENIOR_ONLY,
        intro: 'ROAR is led by residents and young radiation oncologists, and values the experience of senior colleagues.',
        questions: [
          { id: 'senior_role', type: 'single', label: 'Your current role', options: ['Faculty in a teaching institution', 'Consultant in a non-teaching hospital', 'Head of department', 'Other'] },
          { id: 'senior_gaps', type: 'multi', max: 3, label: 'Where do you see the biggest gaps in radiation oncology training today? Choose up to 3.', options: [
            'Modern techniques', 'Brachytherapy', 'Contouring and planning', 'Clinical judgement', 'Research skills', 'Communication with patients', 'Exam-focused learning', 'Working conditions'] },
          { id: 'senior_support', type: 'multi', label: 'Would you like to support ROAR\'s work?', options: [
            'Mentoring residents', 'Teaching sessions', 'Hosting observerships', 'Guiding research', 'Not at this time'] },
        ],
      },
      {
        id: 'roar', title: 'ROAR\'s priorities',
        intro: 'Help us decide what ROAR should work on first.',
        questions: [
          { id: 'priorities', type: 'multi', max: 3, required: true, label: 'What should ROAR focus on first? Choose up to 3.', options: [
            'Fair duty hours', 'Fair stipends and pay', 'Training exposure and standards', 'Contouring and planning teaching', 'Observerships',
            'Research support', 'Mentorship and careers', 'Exam preparation', 'Mental health and wellbeing', 'Dignity at work', 'Job opportunities'] },
          { id: 'programmes', type: 'multi', label: 'Which ROAR programmes would you take part in?', options: [
            'Contour Club (monthly live contouring)', 'Passport (observerships between centres)', 'Research Collective (multi-centre projects)',
            'Global (fellowships abroad)', 'Wellbeing (peer support)', 'Exam preparation sessions'] },
          { id: 'formats', type: 'multi', label: 'How do you prefer to learn?', options: ['Live online sessions', 'Recorded lectures', 'In-person workshops', 'Case-based small groups'] },
          { id: 'one_change', type: 'text', label: 'If you could change one thing about radiation oncology training in India, what would it be?', help: 'Please don\'t name individuals or institutions.' },
          { id: 'anything_else', type: 'text', label: 'Anything else you would like ROAR to know?' },
        ],
      },
    ],
  };
})();
