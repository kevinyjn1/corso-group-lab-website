/** Site-wide configuration: names, navigation, and the facts about the group that are not lists. */

export const site = {
  name: 'Corso Group',
  mark: 'COG',
  university: 'University of Michigan',
  title: 'Corso Group (COG) at the University of Michigan',
  description:
    'The Corso Group at the University of Michigan builds AI that sees, describes, and works alongside people in the physical world - computer vision, language, and robotics with applications in health, autonomy, and everyday life.',
  email: 'jjcorso@umich.edu',
  location: 'Ann Arbor, Michigan',
  links: {
    github: 'https://github.com/MichiganCOG',
    scholar: 'https://scholar.google.com/citations?hl=en&user=g9bV-_sAAAAJ',
    voxel51: 'https://voxel51.com/',
    cv: 'https://web.eecs.umich.edu/~jjcorso/jcorso-cv.pdf',
    essays: 'https://medium.com/@jasoncorso',
    x: 'https://x.com/_JasonCorso_',
    robotics: 'https://robotics.umich.edu/',
    eecs: 'https://eecs.engin.umich.edu/',
    legacy: 'https://web.eecs.umich.edu/~jjcorso/',
  },
  /** Citation figures from Prof. Corso's Google Scholar profile. */
  scholar: { citations: '24K+', hIndex: 53, asOf: 'November 2026' },
  /** Date of the public curriculum vitae that the alumni and course lists were taken from. */
  cv: { asOf: 'April 2025' },
} as const;

export const nav = [
  { label: 'Research', path: '/research/' },
  { label: 'Publications', path: '/publications/' },
  { label: 'People', path: '/people/' },
  { label: 'Code & Data', path: '/resources/' },
  { label: 'Teaching', path: '/teaching/' },
  { label: 'Join', path: '/join/' },
] as const;

export const pi = {
  name: 'Jason J. Corso',
  titles: [
    'Professor of Robotics',
    'Professor of Electrical Engineering and Computer Science',
    'Co-Founder and Chief Science Officer, Voxel51',
  ],
  bio: [
    'Jason Corso is a Professor of Robotics and of Electrical Engineering and Computer Science at the University of Michigan, where he was a founding faculty member of the Department of Robotics. He is also Co-Founder and Chief Science Officer of Voxel51, the company behind the open-source FiftyOne toolkit for visual AI.',
    'His research focuses on cognitive systems and their entangled challenges in vision, language, robotics, and the physical world. Much of his work is on video understanding - video segmentation, activity recognition, and connecting video to natural language.',
    'He received his Ph.D. in Computer Science from The Johns Hopkins University, was a postdoctoral fellow at UCLA, and served on the faculty at SUNY Buffalo from 2007 to 2014 before joining Michigan.',
  ],
  honors: [
    { year: 2018, name: 'EECS Outstanding Achievement Award, University of Michigan' },
    { year: 2016, name: 'Best Associate Editor Award, ICRA' },
    { year: 2015, name: 'Google Faculty Research Award' },
    { year: 2011, name: 'SUNY at Buffalo Young Investigator Award' },
    { year: 2010, name: 'Army Research Office Young Investigator Award' },
    { year: 2009, name: 'National Science Foundation CAREER Award' },
    { year: 2009, name: 'DARPA Computer Science Study Group' },
    { year: 2003, name: 'Link Foundation Fellowship in Advanced Simulation and Training' },
  ],
} as const;

/** Agencies and companies that have funded the group, per Prof. Corso's CV. */
export const sponsors = [
  'National Science Foundation',
  'National Institutes of Health',
  'DARPA',
  'ARPA-H',
  'Army Research Office',
  'IARPA',
  'NIST',
  'Toyota Research Institute',
  'Google',
  'Samsung',
] as const;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix an absolute site path with the configured base path. */
export function href(path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** True when `current` is `path` or a page beneath it. */
export function isActive(current: string, path: string): boolean {
  const target = href(path);
  return current === target || current.startsWith(target);
}
