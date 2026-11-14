# Builds the four "area" pages (Education, Careers, Welfare, Community).
# Each page shows ROAR's vision to every visitor; signed-in members also see the live content
# in the members' panel (filled in by js/members-area.js).
# Usage: python tools/build_area_pages.py   (rewrites website/learn.html, opportunities.html, desks.html, community.html)
import os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'website')

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title} – ROAR</title>
  <meta name="description" content="{desc}">
  <meta property="og:title" content="{title} – ROAR">
  <meta property="og:description" content="{desc}">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script src="js/theme.js"></script>
</head>
<body data-page="{page}">
<div id="site-header"></div>

<main id="main">
"""
FOOT = """</main>

<div id="site-footer"></div>
<script src="js/layout.js"></script>
<script src="shader.js"></script>
<script src="main.js"></script>
<script src="js/config.js"></script>
<script src="js/public.js"></script>
<script src="js/members-area.js"></script>{extra_js}
</body>
</html>
"""

def hero(eyebrow, h1, lead):
    return f"""<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{h1}</h1>
    <p class="lead">{lead}</p>
  </div>
</section>
"""

def zone(area, guest_title, guest_text, portal_hash):
    # Visitors see the invitation; js/members-area.js swaps in the live content for signed-in members
    return f"""<section class="section-tight members-zone" id="members" data-members-zone="{area}" aria-live="polite">
  <div class="wrap">
    <div class="cta-band glass mz-guest">
      <div>
        <span class="eyebrow">Members' area</span>
        <h2>{guest_title}</h2>
        <p>{guest_text}</p>
      </div>
      <div class="gate-actions">
        <a class="btn btn-primary" href="portal/{portal_hash}">Sign in</a>
        <a class="btn btn-glass" href="portal/{portal_hash}" data-signup>Create a free account</a>
      </div>
    </div>
  </div>
</section>
"""

def pillars(eyebrow, h2, items, alt=False, intro=''):
    cards = ''.join(f'<article class="card vcard"><span class="vcard-n">{i + 1:02d}</span><h3>{t}</h3><p>{d}</p></article>' for i, (t, d) in enumerate(items))
    return f"""<section{' class="alt"' if alt else ''}>
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">{eyebrow}</span><h2>{h2}</h2>{f'<p class="lead">{intro}</p>' if intro else ''}</div>
    <div class="cards vcards">{cards}</div>
  </div>
</section>
"""

def grid(eyebrow, h2, items, extra='', alt=False):
    lis = ''.join(f'<li class="card"><h3>{t}</h3><p>{d}</p></li>' for t, d in items)
    return f"""<section{' class="alt"' if alt else ''}>
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">{eyebrow}</span><h2>{h2}</h2></div>
    <ul class="gate-list">{lis}</ul>
    {extra}
  </div>
</section>
"""

PAGES = {
  'learn.html': dict(page='learn', title='Education',
    desc="ROAR's vision for radiation oncology training in India: fair exposure for every resident, Contour Club, observerships, a curated learning library and members' sessions.",
    body=hero('Education', 'Excellent training for <span class="glow">every resident.</span>',
              "Where you train should not decide what you learn. ROAR's programmes aim to give every radiation oncology resident in India fair exposure to modern practice, good teaching and a research culture.")
      + zone('education', 'Your learning library and sessions', 'Members see the learning library, upcoming sessions and case files right here. Creating an account is free for radiation oncology residents and radiation oncologists in India.', '#learning')
      + pillars('Our vision', 'Training that does not depend on where you were placed.', [
          ('Equal exposure', 'A minimum exposure standard: the techniques, sites and planning experience every residency should cover, so gaps can be seen and closed.'),
          ('Learning together', 'Live contouring, case discussions and teaching sessions that connect residents across centres with experienced teachers.'),
          ('A research culture', 'Multi-centre resident projects with shared authorship, so every resident can take part in research, not only those at large institutes.')])
      + grid('Programmes', 'What we are building for members.', [
          ('ROAR Contour Club', 'A monthly live contouring session with expert feedback, with case files to work through afterwards.'),
          ('Learning library', 'Guidelines, contouring atlases, courses and exam preparation, chosen by the Academic Society.'),
          ("Members' sessions", 'Webinars and Q&amp;As with senior colleagues, with recordings for members who missed them.'),
          ('ROAR Passport', 'Structured observerships between Indian centres, so that training does not depend on where you were placed.'),
          ('Research Collective', 'Multi-centre resident projects with shared authorship.'),
          ('Minimum exposure standard', 'What every residency should cover, and how institutions measure up.')], alt=True)),

  'opportunities.html': dict(page='opportunities', title='Careers',
    desc="ROAR's vision for careers in radiation oncology: transparent job and fellowship listings, one-to-one guidance and mentorship, and fair contracts for young radiation oncologists.",
    body=hero('Careers', 'Your next post, <span class="glow">fellowship or observership.</span>',
              'No young radiation oncologist should have to find their way alone. ROAR brings openings into the open and connects every member with someone who has walked the path before.')
      + zone('careers', 'Open positions and one-to-one help', "Members see current job, fellowship and observership listings here, and can ask founders and mentors for help with a CV, a fellowship or a contract.", '#careers')
      + pillars('Our vision', 'Careers built on information, not on who you know.', [
          ('Openings in the open', 'Senior residency and consultant posts, fellowships and observerships in one place, so opportunity reaches every resident.'),
          ('A mentor for everyone', 'One-to-one guidance from founders and mentors for CVs, fellowship applications, exams and research.'),
          ('Fair terms', 'Clear advice on contracts, bonds, notice periods, duty hours and pay, and benchmarks that show what fair looks like.')])
      + grid('How we help', 'What members get.', [
          ('Job and fellowship listings', 'Senior residency and consultant posts, fellowships in India and abroad, observerships and research openings.'),
          ('CV review', 'Feedback on your CV before you apply for a post or fellowship.'),
          ('Fellowship guidance', 'Choosing a fellowship, writing the application, and preparing for interviews.'),
          ('Job search and contracts', 'What to check in a contract: bonds, notice periods, call duties and pay.'),
          ('Exam preparation', 'Guidance for MD/DNB and other exams from those who have just passed them.'),
          ('Research mentorship', 'Help with a thesis, a paper or a first project.')],
          extra='<p class="note" style="margin-top:20px">Hiring, or offering a fellowship or observership? <a href="contact.html?topic=Post%20an%20opportunity">Send it to us</a> and we will share it with members.</p>', alt=True)),

  'desks.html': dict(page='desks', title='Welfare',
    desc="ROAR's Member Welfare Charter: confidential support on training, working conditions and wellbeing for radiation oncology residents and young radiation oncologists in India.",
    body=hero('Welfare', 'Supporting <span class="glow">every member.</span>',
              'Good patient care starts with residents who are trained well, treated fairly and looked after. The Member Welfare Charter sets out how ROAR stands with every member, in confidence.')
      + zone('welfare', 'Confidential support for members', 'Members can raise a concern in confidence and follow their requests here. Everything shared with ROAR is anonymised, and no member or institution is ever named without written consent.', '#welfare')
      + pillars('Our promise', 'The Member Welfare Charter.', [
          ('Anonymised', 'Concerns and survey answers are anonymised (Article 8G).'),
          ('Never named without consent', 'No member or institution is named in connection with a concern without written consent.'),
          ('No exposure', "An office-bearer who reveals a reporter's identity is removed from office (Article 8K).")])
      + grid('Support desks', 'Where members can turn.', [
          ('Education Standards Desk', 'Confidential help when your training falls short, including teaching and observerships elsewhere.'),
          ('Grievance cell', 'Advice on duty hours, delayed stipends, senior-resident pay, contracts, bonds, leave and radiation safety.'),
          ('Dignity at work desk', 'Support and guidance on bullying, harassment or discrimination, including POSH and anti-ragging routes.'),
          ('Peer support', 'A confidential peer-support network linked to professional mental-health care.'),
          ('Benchmarks', 'The national Stipend Index and Senior Resident Pay Benchmark, as they are published.'),
          ('National survey', 'Take part in the national survey of radiation oncologists, which is anonymous.')],
          extra='<div class="card help-now" style="margin-top:22px"><h3>Need help right now?</h3><p>You don’t need an account for this. Call <b><a href="tel:14416">Tele-MANAS on 14416</a></b> (or <a href="tel:18008914416">1-800-891-4416</a>), India’s free 24-hour mental health helpline. For harassment, you can go directly to your institution’s Internal Committee under the POSH Act or its anti-ragging committee.</p></div>', alt=True)),

  'community.html': dict(page='community', title='ROAR Community',
    desc="ROAR Community: a members-only space where India's radiation oncology residents and young consultants ask questions, share articles and cases, follow colleagues and learn together.",
    body=hero('ROAR Community', 'Learn from each other, <span class="glow">every day.</span>',
              "A members-only space where India's radiation oncology residents and young consultants ask questions, discuss cases, share articles and keep up with each other, across every centre and state.")
      + zone('community', 'Join the conversation', 'Members see the latest questions, cases and articles here, and can open Community to post, comment and follow colleagues. Creating an account is free.', '#community')
      + pillars('Our vision', 'One department, as big as India.', [
          ('Ask anyone', 'A resident in a small centre can put a question to peers and seniors across the country, and get a considered answer.'),
          ('Learn from real cases', 'Anonymised case discussions and planning questions, with the best answers marked so they are easy to find later.'),
          ('Stay connected', 'Follow colleagues, topics and hashtags, and keep up with what ROAR is doing.')])
      + grid('Inside Community', 'Made for radiation oncology.', [
          ('Topics', 'Head &amp; Neck, Breast, CNS, SBRT &amp; SRS, Brachytherapy, Physics &amp; Planning, Contouring, Exams, Careers, Wellbeing and more.'),
          ('Questions and accepted answers', 'Threaded answers with up and down votes; the person who asked marks the answer that helped.'),
          ('Case discussions with photos', 'Up to four photos per post, resized and stripped of location data, with a patient-privacy check before posting.'),
          ('Polls', 'Quick polls with secret votes: “What would you do?”'),
          ('Profiles and stories', 'Your own profile with a photo and bio, and 24-hour stories for events and moments.'),
          ('Notifications', 'Know when someone answers, replies, mentions you or follows you.')],
          extra='<div class="card" style="margin-top:22px"><h3>Community guidelines</h3><p><b>Protect patients:</b> never post anything that could identify a patient. <b>Respect everyone</b>, seniors, peers and other specialties alike. <b>Cite sources.</b> <b>No advertising</b> without the Founders’ Council’s approval. The Founders’ Council reviews every report.</p></div>', alt=True)),
}


PAGES['mentorship.html'] = dict(page='mentorship', title='Mentorship',
    desc="ROAR Mentorship: one-to-one guidance for India's radiation oncology residents from experienced colleagues, on CVs, fellowships, exams, research and careers.",
    body=hero('Mentorship', 'Someone who has <span class="glow">walked the path.</span>',
              "Every young radiation oncologist deserves a mentor. ROAR matches residents with senior residents, consultants and alumni who give an hour a month to help with a CV, a fellowship, an exam or a first research project.")
      + zone('mentorship', 'Find your mentor', 'Members can browse mentors by area and the help they offer, and send a request. Mentors approved by the Founders\' Council appear here.', '#mentorship')
      + pillars('How it works', 'Three steps.', [
          ('Find a mentor', 'Browse mentors by area (Head &amp; Neck, SBRT, Brachytherapy and more) and by what they help with: CVs, fellowships, exams, research or careers.'),
          ('Send a request', 'Say where you are in training, what you are aiming for and any deadlines. Up to three requests can wait for an answer at a time.'),
          ('Meet', 'When a mentor accepts, you both see each other\'s email and agree how to meet. Mark the request done when you have what you need.')])
      + grid('Mentors', 'Why mentor with ROAR.', [
          ('Give back', 'Help the next generation avoid the mistakes you made, an hour a month.'),
          ('On your terms', 'Choose the areas and kinds of help you offer, how many mentees you take, and pause at any time.'),
          ('Approved and listed', 'The Founders\' Council approves every mentor, so members know who they are talking to.'),
          ('Recognised', 'Mentors are acknowledged in ROAR\'s annual report (with their permission).'),
          ('Private', 'Contact details are shared only when you accept a request.'),
          ('Open to all stages', 'Senior residents can mentor juniors; consultants and alumni can mentor everyone.')],
          extra='<p class="note" style="margin-top:20px">Ready to help? <a href="portal/#mentorship">Offer to mentor</a> in My ROAR.</p>', alt=True))

PAGES['research.html'] = dict(page='research', title='Research',
    desc="The ROAR Research Collective: multi-centre research led by radiation oncology residents across India, with shared authorship and mentorship.",
    body=hero('Research', 'Research by residents, <span class="glow">across India.</span>',
              "The ROAR Research Collective brings residents from many centres together on questions that matter to Indian patients and trainees, with shared authorship, mentorship and support from the Research Society.")
      + """<section class="section-tight" id="projects">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Projects</span><h2>Open projects.</h2><p class="lead">Express interest to join as a site or a contributor. Members see a short form; the project lead gets in touch.</p></div>
    <div id="research-projects" class="research-list" aria-live="polite"><p class="muted">Loading projects…</p></div>
  </div>
</section>
"""
      + pillars('Our approach', 'Research that includes everyone.', [
          ('Multi-centre by design', 'Large centres and small ones contribute equally, so results reflect practice across India.'),
          ('Shared authorship', 'Clear authorship rules agreed at the start, so every contributor is credited.'),
          ('Mentored', 'Each project has a senior adviser, and new researchers learn methods as they go.')])
      + grid('How to take part', 'Ways to get involved.', [
          ('Join a project', 'Express interest in an open project as a site lead or contributor.'),
          ('Propose a project', 'Have an idea for a multi-centre study? <a href="contact.html?topic=Research%20proposal">Tell the Research Society</a>.'),
          ('Learn methods', 'Statistics, protocol writing and publishing sessions in the learning programme.'),
          ('The national survey', 'ROAR\'s first project: the national survey of radiation oncology training and welfare.'),
          ('Ethics and data', 'Help with ethics committee approval, consent and data protection for multi-centre work.'),
          ('Publish', 'Guidance on journals, reporting standards and presenting at conferences.')], alt=True))

for name, p in PAGES.items():
    html = HEAD.format(**p) + p['body'] + FOOT.replace('{extra_js}', '\n<script src="js/research.js"></script>' if name == 'research.html' else '')
    open(os.path.join(ROOT, name), 'w', encoding='utf8').write(html)
    print('wrote', name)

# Keep the app and link-preview tags on the rebuilt pages
import runpy
runpy.run_path(os.path.join(os.path.dirname(__file__), "add_head_tags.py"))
