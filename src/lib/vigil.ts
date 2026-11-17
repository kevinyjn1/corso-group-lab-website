/**
 * VIGIL, the group's flagship project, in one place: the facts that the home page band, the
 * Research page, and the project's own page are written from.
 *
 * Every fact here was read on its source in November 2026. Each one names its sources, and the
 * project page lists them all, so a reader can check any line. When a fact changes, update the
 * date in its text as well.
 */

export const SOURCES = {
  award: {
    label: 'ARPA-H, the VIGIL award',
    href: 'https://arpa-h.gov/explore-funding/awards/3401',
  },
  paradigm: {
    label: 'ARPA-H, the PARADIGM program',
    href: 'https://arpa-h.gov/explore-funding/programs/paradigm',
  },
  release: {
    label: 'ARPA-H, announcement of the twelve teams, February 2025',
    href: 'https://arpa-h.gov/news-and-events/arpa-h-works-deliver-advanced-hospital-level-care-rural-areas',
  },
  michigan: {
    label: 'Michigan Engineering News, February 2025',
    href: 'https://news.engin.umich.edu/2025/02/bridging-gaps-in-rural-health-care-with-ai-powered-mobile-clinics',
  },
  detroit: {
    label: 'The Detroit News, May 2026, as carried by EMS1',
    href: 'https://www.ems1.com/artificial-intelligence/ai-equipped-rigs-bring-hospital-level-care-to-rural-mich-patients',
  },
  cardiac: {
    label: 'Jason Corso on LinkedIn, November 2025',
    href: 'https://www.linkedin.com/posts/jason-corso_arpah-paradigm-aiinhealthcare-ugcPost-7399133694583529472-7GUC/',
  },
  goggles: {
    label: 'Jason Corso on LinkedIn, January 2026',
    href: 'https://www.linkedin.com/posts/jason-corso_is-the-dream-of-head-mounted-displays-ugcPost-7416532581472591872-ztyO/',
  },
  update: {
    label: 'Jason Corso on LinkedIn, August 2026',
    href: 'https://www.linkedin.com/posts/jason-corso_delivering-effective-healthcare-anywhere-ugcPost-7495463545971597312-wGDo/',
  },
} as const;

export type SourceId = keyof typeof SOURCES;

interface Sourced {
  sources: readonly SourceId[];
}

interface Fact extends Sourced {
  value: string;
  label: string;
}

interface Step extends Sourced {
  name: string;
  title: string;
  body: string;
}

interface Moment extends Sourced {
  when: string;
  what: string;
}

const facts: readonly Fact[] = [
  { value: '$24.6M', label: 'ARPA-H award, up to, begun February 2025', sources: ['award'] },
  { value: '8 + 1', label: 'Universities and RTX BBN on one team', sources: ['michigan'] },
  { value: '4', label: 'Clinical services guided, as of August 2026', sources: ['update'] },
  { value: '1', label: 'Workstation runs it all, with no cloud', sources: ['detroit'] },
];

/** How the system works, in the order things happen in the room. */
const steps: readonly Step[] = [
  {
    name: 'Sense',
    title: 'One shared view of the room',
    body: 'Color cameras, depth cameras, and microphones watch and listen to the exam. The clinician, the patient, and the AI work from the same picture of what is happening, which the team calls a shared perceptual space.',
    sources: ['cardiac'],
  },
  {
    name: 'Understand',
    title: 'Follow the task as it unfolds',
    body: "The agent observes the clinician's actions against the steps of the procedure and recognizes when something unexpected has happened. For a heart exam, a deep network predicts where the ultrasound probe should go and scores the view as it changes. A medical question-answering system takes clinical questions on the spot.",
    sources: ['michigan', 'cardiac'],
  },
  {
    name: 'Guide',
    title: 'Put the help where the work is',
    body: 'Light projected onto the patient shows where to begin. A screen shows what the probe is touching and which way to turn it, and a voice in an earpiece talks the clinician through. After the visit, the system writes the report.',
    sources: ['detroit'],
  },
  {
    name: 'Run anywhere',
    title: 'No cloud to call',
    body: 'A rural road cannot count on Wi-Fi or 5G. Everything has to run on one workstation in the vehicle, on two to four kilowatts of power instead of a data center.',
    sources: ['detroit'],
  },
];

const timeline: readonly Moment[] = [
  {
    when: 'February 2025',
    what: 'ARPA-H selects twelve teams for PARADIGM. Michigan leads one of the two that build the AI guidance, with an award of up to $24.6 million.',
    sources: ['release', 'award'],
  },
  {
    when: 'November 2025',
    what: 'A demonstration video shows guided cardiac ultrasound, with a medical question-answering system for use in the field.',
    sources: ['cardiac'],
  },
  {
    when: 'January 2026',
    what: 'The team makes its interface decision public: in the clinic, no head-mounted display. Guidance is projected into the room.',
    sources: ['goggles'],
  },
  {
    when: 'May 2026',
    what: 'Demonstrations for federal, state, and university officials: a deep vein thrombosis scan, a cardiac ultrasound, and positioning a patient for an X-ray.',
    sources: ['detroit'],
  },
  {
    when: 'August 2026',
    what: 'Eighteen months in, VIGIL supports four clinical services, and user studies show generalists reaching significant proficiency with its help.',
    sources: ['update'],
  },
  {
    when: 'Next',
    what: 'Testing inside the mobile clinic itself, which the team expected to reach in the third year of the project.',
    sources: ['michigan'],
  },
];

export const vigil = {
  name: 'VIGIL',
  path: '/vigil/',
  /** The full name, split so that the letters spelling the acronym can be marked. */
  expansion: [
    ['V', 'ectors of'],
    ['I', 'ntelligent'],
    ['G', 'uidance'],
    ['i', 'n'],
    ['L', 'ong-Reach Rural Healthcare'],
  ],
  fullName: 'Vectors of Intelligent Guidance in Long-Reach Rural Healthcare',
  tagline: 'Specialist-level care, anywhere.',
  summary:
    'VIGIL is an AI agent that sees, hears, and guides. It coaches a nurse or a family doctor, step by step, through exams and procedures that usually need a specialist, so that hospital-level care can travel to the people who live farthest from a hospital.',
  /** The award, as ARPA-H lists it. */
  award: {
    funder: 'ARPA-H',
    funderName: 'Advanced Research Projects Agency for Health',
    program: 'PARADIGM',
    programName: 'Platform Accelerating Rural Access to Distributed and Integrated Medical Care',
    area: 'Technical Area 5, intelligent task guidance',
    amount: 'Up to $24.6M',
    started: 'February 12, 2025',
    pi: 'Jason J. Corso',
    prime: 'University of Michigan',
    manager: 'Bon Ku, M.D., MPP',
  },
  facts,
  steps,
  /** Tasks the team has shown or named in public, and what it has said may come next. */
  services: {
    now: [
      { name: 'Cardiac ultrasound', note: 'Shown to officials, May 2026' },
      { name: 'Deep vein thrombosis scan', note: 'Shown to officials, May 2026' },
      { name: 'Positioning for an X-ray', note: 'Shown to officials, May 2026' },
      { name: 'Laryngoscopy', note: 'Named by the team, August 2026' },
    ],
    next: [
      '20-week fetal anatomy scans',
      'CT scans',
      'Blood testing with a centrifuge',
      'A drug mixing station',
      'Access to a chemotherapy port',
    ],
    /** Other forms the system has been built in, for demonstrations and training. */
    forms: [
      'A digital twin for simulation-based training',
      'A portable version',
      'A virtual-reality version of the ultrasound guidance',
    ],
  },
  timeline,
  /** The team as it was announced in February 2025, by sub-team and institution. */
  team: [
    {
      name: 'Technical',
      note: 'Models of the task, the room, the patient, and the clinician',
      groups: [
        {
          place: 'University of Michigan',
          people: [
            'Jason Corso, principal investigator (physical AI)',
            'Anhong Guo (interactive systems)',
            'Andrew Owens (multimodal AI)',
            'Mike Oelke (project management)',
          ],
        },
        {
          place: 'Colorado State University',
          people: [
            'Nathaniel Blanchard (computer vision)',
            'Nikhil Krishnaswamy (AI language)',
            'Sarath Sreedharan (AI physical systems)',
            'Bruce Draper (computer vision)',
          ],
        },
        {
          place: 'Stevens Institute of Technology',
          people: ['Enrique Dunn (3D environment modeling)'],
        },
        {
          place: 'Northeastern University',
          people: ['Ehsan Elhamifar (task and recovery monitoring)'],
        },
        {
          place: 'University of Pennsylvania',
          people: ['Alison Marie Pouch (medical image analysis)'],
        },
        { place: 'Purdue University', people: ['Jeffrey Siskind (AI physical systems)'] },
        { place: 'University of Rochester', people: ['Chenliang Xu (multimodal AI)'] },
      ],
    },
    {
      name: 'Medical',
      note: 'How the care is given, and the data to learn it from',
      groups: [
        {
          place: 'University of Michigan',
          people: [
            'Prashant Mahajan and Kevin Ward (emergency medicine)',
            'Milisa Manojlovich (nursing)',
            'Donald Likosky (outcomes assessment)',
            'Francis Pagani (cardiac surgery)',
          ],
        },
        {
          place: 'University of Pennsylvania',
          people: [
            'Alison Marie Pouch (medical image analysis)',
            'Emily Mackay (cardiac anesthesia)',
          ],
        },
        {
          place: 'Central Michigan University',
          people: [
            'Sethu Reddy (endocrinology)',
            'Alison Arnold (rural medicine)',
            'Steve Vance (rural medicine)',
          ],
        },
      ],
    },
    {
      name: 'Systems integration',
      note: 'Building the prototype and testing it in clinics',
      groups: [
        {
          place: 'RTX BBN Technologies',
          people: [
            'Brian van Voorst (lead scientist and research fellow)',
            'Muntaha Samad (principal engineer of research)',
          ],
        },
      ],
    },
  ],
  /** Ids in src/data/publications.yaml of the group's papers on the same problems. */
  papers: ['bellos2026echovqa', 'guo2026follow', 'bellos2025effective'],
} as const;
