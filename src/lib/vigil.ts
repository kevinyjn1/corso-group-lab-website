/**
 * VIGIL, the group's project in rural healthcare, in one place: the facts that the home page band, the
 * Research page, and the project's own page are written from.
 *
 * Every fact here was read on its source in November 2026. The page does not cite them: the
 * record of which source backs which line is kept with the project's notes, not in the site.
 * When a fact changes, update the date in its text as well.
 */

/** The few outside pages that the project page links to in its text. */
export const LINKS = {
  award: 'https://arpa-h.gov/explore-funding/awards/3401',
  michigan:
    'https://news.engin.umich.edu/2025/02/bridging-gaps-in-rural-health-care-with-ai-powered-mobile-clinics',
  sitevisit:
    'https://www.linkedin.com/posts/jason-corso_the-team-the-team-the-team-the-vigil-share-7461791088459157504-eJ6b/',
} as const;

interface Step {
  name: string;
  title: string;
  body: string;
}

interface Moment {
  when: string;
  what: string;
}

/** How the system works, in the order things happen in the room. */
const steps: readonly Step[] = [
  {
    name: 'Sense',
    title: 'One shared view of the room',
    body: 'Color cameras, depth cameras, and microphones watch and listen to the exam. The clinician, the patient, and the AI work from the same picture of what is happening, which the team calls a shared perceptual space.',
  },
  {
    name: 'Understand',
    title: 'Follow the task as it unfolds',
    body: "The agent observes the clinician's actions against the steps of the procedure and recognizes when something unexpected has happened. For a heart exam, a deep network scores the view as it changes, from the ultrasound image alone: on target, close, or far from the standard four-chamber view. A second model answers questions about the image: which view it shows, which chambers are visible, and how to adjust the probe.",
  },
  {
    name: 'Guide',
    title: 'Put the help where the work is',
    body: 'Light projected onto the patient shows where to begin. A screen shows what the probe is touching and which way to turn it, and a voice in an earpiece talks the clinician through each step. The system also drafts the electronic health report, so the clinician can keep their attention on the patient.',
  },
  {
    name: 'Run anywhere',
    title: 'No cloud to call',
    body: 'A rural road cannot count on Wi-Fi or 5G. Everything has to run on one workstation in the vehicle, on two to four kilowatts of power instead of a data center.',
  },
];

const timeline: readonly Moment[] = [
  {
    when: 'February 2025',
    what: 'ARPA-H selects twelve teams for PARADIGM. Michigan leads one of the two that build the AI guidance, with an award of up to $24.6 million.',
  },
  {
    when: 'November 2025',
    what: "The team demonstrates VIGIL live at ARPA-H's PARADIGM meeting in Washington, guiding people through ultrasound exams of the heart and the leg.",
  },
  {
    when: 'January 2026',
    what: 'The team makes its interface decision public: in the clinic, no head-mounted display. Guidance is projected into the room.',
  },
  {
    when: 'May 2026',
    what: 'At the annual site visit at Michigan, the team demonstrates a deep vein thrombosis scan, a cardiac ultrasound, and positioning a patient for an X-ray to federal, state, and university officials. The team counts 61 people at ten institutions.',
  },
  {
    when: 'August 2026',
    what: 'VIGIL supports four clinical services, and user studies show generalists reaching significant proficiency with its help.',
  },
];

/** What comes after the last dated moment. Kept out of the timeline, whose rows are all dates. */
const ahead = 'Testing inside the mobile clinic itself, planned for the third year of the project.';

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
    'VIGIL is physically grounded upskilling at work: an AI agent that sees, hears, and guides. It coaches a nurse or a family doctor, step by step, through exams that usually need a specialist. The aim is to turn generalists into specialists on the fly, so that hospital-level care can travel to the people who live farthest from a hospital.',
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
  steps,
  /** Tasks the team has shown or named in public, and what it has said may come next. */
  services: {
    now: [
      { name: 'Cardiac ultrasound', note: 'Demonstrated live, November 2025' },
      { name: 'Deep vein thrombosis scan', note: 'Demonstrated live, November 2025' },
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
  ahead,
  /**
   * The team by sub-team and institution: as announced in February 2025, with Cornell Tech, where
   * Andrew Owens has since moved.
   */
  team: [
    {
      name: 'Technical',
      note: 'Models of the task, the room, the patient, and the clinician',
      groups: [
        {
          place: 'University of Michigan',
          people: [
            'Jason J. Corso, principal investigator (physical AI)',
            'Anhong Guo (interactive systems)',
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
        {
          place: 'Cornell Tech',
          people: ['Andrew Owens (multimodal AI), at Michigan when the project began'],
        },
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
            'Prashant Mahajan (emergency medicine)',
            'Kevin Ward (emergency medicine)',
            'Milisa Manojlovich (nursing)',
            'Donald Likosky (outcomes assessment)',
            'Francis Pagani (cardiac surgery)',
          ],
        },
        {
          place: 'University of Pennsylvania',
          people: [
            'Alison Marie Pouch (medical image analysis)',
            'Emily MacKay (cardiac anesthesia)',
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
            'Brian VanVoorst (lead scientist and research fellow)',
            'Muntaha Samad (principal engineer of research)',
          ],
        },
      ],
    },
  ],
  /** Ids in src/data/publications.yaml of the group's papers on the same problems. */
  papers: ['bellos2026echovqa', 'guo2026follow', 'bellos2025effective'],
} as const;
