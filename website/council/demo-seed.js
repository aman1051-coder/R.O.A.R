// Starting data for DEMO mode only (no database connected).
// Real data lives in Supabase; this file is never used once config.js is filled in.
window.ROAR_DEMO_SEED = (function () {
  const founders = [
    ['aakash', 'Dr. Aakash Bellige', 'President', true],
    ['aman', 'Dr. Aman Gupta', 'Chairman', true],
    ['kratika', 'Dr. Kratika Bhatia', 'General Secretary', true],
    ['shriya', 'Dr. Shriya Dhingra', 'Additional Secretary – Spokesperson', false],
    ['deepika', 'Dr. Deepika Sharma', 'Additional Secretary – Social Media & Surveys', false],
    ['arshida', 'Dr. Arshida Pulimala', 'Additional Secretary – Academic Society & Graphics', false],
    ['arsheya', 'Dr. Arsheya Gupta', 'Additional Secretary – Research Society', false],
    ['honey', 'Dr. Honey Sharma', 'Additional Secretary – Grievances & Legalities', false],
    ['abhishek', 'Dr. Abhishek Bhadri', 'Additional Secretary – Treasurer & Memberships', false],
  ].map(([k, name, cabinet_role, is_admin], i) => ({ email: k + '@demo.roar', username: name.replace(/^Dr\.\s*/, '').toLowerCase().replace(/\s+/g, '.'), founder_id: 'FC-0' + (i + 1), name, cabinet_role, is_admin, sort: i + 1, password_set: false, can_reset_passwords: cabinet_role === 'Chairman' }));

  let n = 0;
  const id = () => 'demo-' + (++n);
  const task = (title, phase, portfolio, status = 'todo', extra = {}) => ({ id: id(), title, phase, portfolio, owner: null, status, due: null, notes: null, sort: n * 10, ...extra });

  const tasks = [
    task('Appoint a resident Institutional Ambassador in every RO training institution', 'first-3-months', 'Spokesperson', 'doing'),
    task('Design the national survey of RO residents', 'first-3-months', 'Social Media & Surveys', 'doing'),
    task('Consult a lawyer on the registration pathway', 'first-3-months', 'Grievances & Legalities'),
    task('Consult a CA (registration, PAN, 12A/80G)', 'first-3-months', 'Treasurer & Memberships'),
    task('Final name check: Registrar and trademark records for "ROAR"', 'first-3-months', 'Grievances & Legalities'),
    task('File trademark for the name and logo', 'first-3-months', 'Grievances & Legalities'),
    task("Logo design and founders' vote", 'first-3-months', 'Academic Society & Graphics', 'doing'),
    task('Open social media accounts', 'first-3-months', 'Social Media & Surveys'),
    task('Finalise the Member Welfare Charter', 'first-3-months', 'Grievances & Legalities'),
    task('Collect ID and address proof of every founder', 'first-3-months', 'General Secretary'),
    task('Registered-office proof and owner NOC', 'first-3-months', 'General Secretary'),
    task('Memorandum signed by at least 7 founders, witnessed', 'first-3-months', 'General Secretary'),
    task('Affidavit on stamp paper by President or Secretary', 'first-3-months', 'General Secretary'),
    task('Submit registration to the Registrar of Societies with fee', 'first-3-months', 'General Secretary'),
    task('Draft Constitution v3 with first-President provision', 'first-3-months', 'Chairman', 'done'),
    task('Public website live', 'first-3-months', 'Social Media & Surveys', 'done'),
    task('Get PAN and open the bank account (joint operation)', 'after-registration', 'Treasurer & Memberships'),
    task('Apply for 12A and 80G registration', 'after-registration', 'Treasurer & Memberships'),
    task('Register the domain name', 'after-registration', 'Social Media & Surveys'),
    task('Open online membership with document verification', 'after-registration', 'Treasurer & Memberships'),
    task('Enrol the first 20 Founding Members at Rs 1,000', 'after-registration', 'Treasurer & Memberships'),
    task('Circulate the first national survey', 'after-registration', 'Social Media & Surveys'),
    task('Open the grievance cell and Education Standards Desk', 'after-registration', 'Grievances & Legalities'),
    task('Run the first national election under Part VI', 'year-2', 'General Secretary'),
    task('Publish the first State of Young Radiation Oncologists in India report', 'year-2', 'Social Media & Surveys'),
  ];

  const meetings = [
    { id: id(), starts_at: '2026-11-05T14:40:00+05:30', title: "Founders' meeting 1", location: null,
      agenda: 'Vision and agenda; constitution amendments (Article 5); legalities; who can join; voting rights; membership fees; member welfare charter; executive cabinet; first 3 months.',
      attendees: 'Dr A Bellige, Dr A Gupta, Dr K Bhatia, Dr D Sharma, Dr H Sharma, Dr Arshida P, Dr S Dhingra',
      minutes: 'Agreed the vision, membership rules (0–6 years post PG vote; honorary members non-voting), fees (Rs 500/yr, Rs 5,000 life, first 20 founding members Rs 1,000), the executive cabinet, and first-3-month activities. Pending for next meeting: Member Welfare Charter; who can join. Adjourned 4.05 PM.' },
    { id: id(), starts_at: '2026-11-11T16:30:00+05:30', title: "Founders' meeting 2", location: null,
      agenda: 'Member Welfare Charter; who can join; Minus 2 contouring.', attendees: null, minutes: null },
  ];

  const m1 = id(), m2 = id();
  const motions = [
    { id: m1, created_at: '2026-11-06T10:00:00+05:30', created_by: 'aman@demo.roar', title: 'EXAMPLE: Adopt Constitution Draft v3 as the working draft for the lawyer',
      details: 'Send v3 (with Article 16B, first President) to the lawyer for vetting before registration.', options: ['Yes', 'No', 'Abstain'], secret: false, status: 'open', meeting_date: '2026-11-11', outcome: null },
    { id: m2, created_at: '2026-11-06T11:00:00+05:30', created_by: 'arshida@demo.roar', title: 'EXAMPLE: Logo vote',
      details: 'Choose between the three shortlisted logo concepts. Secret ballot.', options: ['Concept A', 'Concept B', 'Concept C', 'Abstain'], secret: true, status: 'open', meeting_date: null, outcome: null },
  ];
  const votes = [
    { id: id(), motion_id: m1, voter_email: 'kratika@demo.roar', choice: 'Yes' },
    { id: id(), motion_id: m1, voter_email: 'honey@demo.roar', choice: 'Yes' },
    { id: id(), motion_id: m1, voter_email: 'shriya@demo.roar', choice: 'Abstain' },
    { id: id(), motion_id: m2, voter_email: 'deepika@demo.roar', choice: 'Concept B' },
    { id: id(), motion_id: m2, voter_email: 'abhishek@demo.roar', choice: 'Concept A' },
  ];

  const registrations = [
    { id: id(), created_at: '2026-11-06T09:12:00+05:30', name: 'Example Resident One', email: 'resident.one@example.com', phone: null, stage: 'RO PG resident, year 2', institution: 'Example Medical College', state: 'Maharashtra', ambassador: true, message: 'No exposure to brachytherapy in our department.', consent: true, status: 'new', notes: null },
    { id: id(), created_at: '2026-11-06T13:40:00+05:30', name: 'Example Resident Two', email: 'resident.two@example.com', phone: null, stage: 'RO, 0–6 years after PG', institution: 'Example Cancer Institute', state: 'Karnataka', ambassador: false, message: 'Senior resident pay varies hugely between centres.', consent: true, status: 'contacted', notes: null },
  ];

  const institutions = [
    { id: id(), name: 'Example Medical College', city: 'Pune', state: 'Maharashtra', region: 'West', ambassador_name: null, ambassador_email: null, ambassador_phone: null, status: 'vacant', show_public: false, notes: null },
  ];

  const announcements = [
    { id: id(), created_at: '2026-11-05T17:00:00+05:30', title: 'ROAR is founded', body: 'Nine radiation oncology residents and young radiation oncologists met on 5 November 2026 and founded ROAR. Registration as a Society is under way.', published: true },
  ];

  const documents = [
    { id: id(), title: 'Constitution Draft v3', url: 'https://example.com/upload-to-drive-and-paste-link', category: 'Constitution', created_at: '2026-11-06T10:00:00+05:30' },
  ];

  const events = [
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'EXAMPLE: ROAR Contour Club – Head & neck', kind: 'Contouring session', starts_on: '2026-12-05', ends_on: null, city: null, format: 'Online', organiser: 'ROAR Academic Society', url: null, description: 'A live case contoured together, with expert feedback. Open to all residents.', roar_event: true, published: true },
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'EXAMPLE: National radiation oncology conference', kind: 'Conference', starts_on: '2026-12-18', ends_on: '2026-12-20', city: 'Example City', format: 'In person', organiser: 'Example society', url: 'https://example.com', description: 'Replace with real events from the console.', roar_event: false, published: true },
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'EXAMPLE: Brachytherapy hands-on workshop', kind: 'Workshop', starts_on: '2027-01-16', ends_on: null, city: 'Example City', format: 'In person', organiser: 'Example institute', url: null, description: null, roar_event: false, published: true },
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'EXAMPLE: Draft event (not published)', kind: 'Webinar', starts_on: '2027-02-01', ends_on: null, city: null, format: 'Online', organiser: null, url: null, description: null, roar_event: true, published: false },
  ];
  const opportunities = [
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'EXAMPLE: Senior Resident, Radiation Oncology (2 posts)', kind: 'Job', organisation: 'Example Medical College', location: 'Example City', deadline: '2026-12-15', url: 'https://example.com', description: 'Stipend stated in the advert. 3-year tenure.', published: true },
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'EXAMPLE: Two-week brachytherapy observership', kind: 'Observership', organisation: 'Example Cancer Centre', location: 'Example City', deadline: null, url: null, description: 'For residents from centres without brachytherapy.', published: true },
  ];
  const resources = [
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'eContour', kind: 'Contouring atlas', level: 'All residents', url: 'https://www.econtour.org', description: 'Free interactive contouring cases and atlases across disease sites.', published: true },
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'ESTRO FALCON', kind: 'Course', level: 'All residents', url: 'https://falcon.estro.org', description: 'ESTRO\'s online contouring workshops with feedback.', published: true },
    { id: id(), created_at: '2026-11-06T10:00:00+05:30', title: 'NRG Oncology contouring atlases', kind: 'Contouring atlas', level: 'Senior residents', url: 'https://www.nrgoncology.org', description: 'Consensus atlases from NRG/RTOG trials (see the CIRO section).', published: true },
  ];
  resources.push({ id: id(), created_at: '2026-11-08T10:00:00+05:30', title: 'EXAMPLE: Contour Club case file – head & neck (members only)', kind: 'Contouring atlas', level: 'All residents', url: 'https://example.com/members/contour-club-1', description: 'Case images and expert contours from the first session.', published: true, members_only: true });
  events.push({ id: id(), created_at: '2026-11-08T10:00:00+05:30', title: 'EXAMPLE: Members\' fellowship Q&A with mentors', kind: 'Webinar', starts_on: '2026-12-12', ends_on: null, city: null, format: 'Online', organiser: 'ROAR', url: null, description: 'Members ask senior colleagues about fellowships in India and abroad.', roar_event: true, published: true, members_only: true });
  const support_requests = [
    { id: id(), created_at: '2026-11-09T11:00:00+05:30', user_id: 'demo:member@demo.roar', email: 'member@demo.roar', name: 'Dr. Example Member', kind: 'Fellowship guidance', details: 'EXAMPLE: I would like advice on applying for brachytherapy fellowships abroad next year.', contact_pref: 'Email', status: 'new', assigned_to: null, notes: null },
  ];
  const messages = [
    { id: id(), created_at: '2026-11-07T09:30:00+05:30', name: 'Example Sender', email: 'sender@example.com', topic: 'Post an opportunity', message: 'EXAMPLE: We have two senior resident posts and would like them listed.', consent: true, status: 'new', notes: null },
  ];

  const memberA = id(), memberB = id();
  const members = [
    { id: memberA, user_id: 'demo:member@demo.roar', email: 'member@demo.roar', created_at: '2026-06-20T10:00:00+05:30', full_name: 'Dr. Example Member', phone: null,
      applying_as: 'resident', specialty: null, course: 'MD', institution: 'Example Medical College', city: 'Pune', state: 'Maharashtra',
      pg_start: '2024-08-01', pg_completion: null, id_card_path: 'demo/id-card-example.pdf', proof_path: 'demo/proof-allotment-letter.pdf',
      plan: 'annual', fee_deferral_requested: false, declarations_at: '2026-06-20T10:00:00+05:30', redeclared_at: '2026-06-20T10:00:00+05:30',
      clock_pause_request: null, appeal: null, status: 'approved', category: 'resident', member_no: 'ROAR-0001', approved_at: '2026-07-01T10:00:00+05:30',
      reviewed_by: 'abhishek@demo.roar', rejection_reason: null, paid_until: '2027-07-01', payment_ref: 'EXAMPLE-UTR-0001', fee_deferred: false, clock_pause_months: 0, notes: null },
    { id: memberB, user_id: 'demo:pending@demo.roar', email: 'pending@demo.roar', created_at: '2026-11-06T18:20:00+05:30', full_name: 'Dr. Example Applicant', phone: null,
      applying_as: 'post_pg', specialty: null, course: 'DNB', institution: 'Example Cancer Institute', city: 'Bengaluru', state: 'Karnataka',
      pg_start: '2020-07-01', pg_completion: '2023-06-30', id_card_path: 'demo/id-card-applicant.jpg', proof_path: 'demo/proof-degree.pdf',
      plan: 'founding', fee_deferral_requested: false, declarations_at: '2026-11-06T18:20:00+05:30', redeclared_at: '2026-11-06T18:20:00+05:30',
      clock_pause_request: null, appeal: null, status: 'submitted', category: null, member_no: null, approved_at: null,
      reviewed_by: null, rejection_reason: null, paid_until: null, payment_ref: null, fee_deferred: false, clock_pause_months: 0, notes: null },
  ];
  const pollOpen = id(), pollClosed = id();
  const elections = [
    { id: pollOpen, created_at: '2026-11-01T09:00:00+05:30', created_by: 'deepika@demo.roar', title: 'EXAMPLE: What should the first national survey cover first?',
      description: 'A consultation to help the founders design the survey. Every voting member can take part.', kind: 'poll',
      options: ['Duty hours', 'Stipends and pay', 'Training exposure', 'Workplace dignity'], opens_at: '2026-11-01T09:00:00+05:30', closes_at: '2026-12-31T23:59:00+05:30', status: 'open' },
    { id: pollClosed, created_at: '2026-10-01T09:00:00+05:30', created_by: 'arshida@demo.roar', title: 'EXAMPLE: Name for the monthly contouring session',
      description: null, kind: 'poll', options: ['Contour Club', 'Target Practice', 'Delineate'], opens_at: '2026-10-01T09:00:00+05:30', closes_at: '2026-10-15T23:59:00+05:30', status: 'closed' },
  ];
  const ballot_receipts = [{ election_id: pollClosed, member_id: memberA }];
  const ballot_votes = [
    { id: id(), election_id: pollClosed, choice: 'Contour Club' },
  ];
  const settings = [{ key: 'membership_open', value: true }];

  return { founders, tasks, meetings, motions, votes, registrations, institutions, announcements, documents, events, opportunities, resources, messages,
    members, elections, ballot_receipts, ballot_votes, settings, support_requests };
})();
