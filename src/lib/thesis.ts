/**
 * The group's thesis, physically grounded upskilling, as Prof. Corso sets it out in his 2026 talk
 * "Physically-Grounded Agentic Upskilling". The home page is built from this file.
 *
 * The talk's slides are not public, so only its title, its three claims, and its closing line are
 * quoted, and every result named here links to its published paper. `figure` names a live figure
 * in src/scripts/figures.ts, and `papers` are ids in src/data/publications.yaml.
 */
import type { FigureName } from './figures';

interface Claim {
  /** The claim in the talk's own words: the end of "Physically-grounded agentic upskilling ...". */
  quote: string;
  /** The same claim, said plainly. */
  title: string;
  body: string;
  figure?: FigureName;
  papers: readonly string[];
}

const claims: readonly Claim[] = [
  {
    quote: 'mandates human-AI teams',
    title: 'A person is a partner, not an oracle.',
    body: 'Most AI treats what a person says as complete and correct. People are not like that: they say "fetch my mug" when three mugs are on the table. The group calls the person a hazy oracle, and teaches the model the one move that makes it a teammate: to know when to act and when to ask again.',
    figure: 'oracle',
    papers: ['lemmer2023evaluating', 'lemmer2023human'],
  },
  {
    quote: 'must monitor for mistakes',
    title: 'Say what went wrong, when, and where.',
    body: 'A guide that only says "that was a mistake" teaches nothing. Mistake attribution names what was wrong (the action or the object), finds the moment it could no longer be undone, and points to where in the scene it happened. The training data are composed automatically from existing video of people at work, and are up to a hundred times larger than earlier mistake datasets.',
    figure: 'human',
    papers: ['li2026mistake', 'storks2025transparent'],
  },
  {
    quote: 'in healthcare delivery',
    title: 'Prove it where care is given.',
    body: 'VIGIL turns generalists into specialists on the fly: it guides a nurse or a family doctor through exams that usually need a specialist, in a clinic that drives to the patient.',
    papers: [],
  },
];

export const thesis = {
  /** The phrase, as the site sets it in headlines. */
  name: 'Physically grounded upskilling',
  /** The title of the talk. */
  talk: 'Physically-Grounded Agentic Upskilling',
  /** Where the talk was given in 2026, in order. */
  venues: ['Colorado State University', 'Tübingen AI Center', 'Salesforce Research'],
  /** A public recording of the talk it grew out of. */
  recording: {
    label: "AI's Role in Upskilling Medical Practice, 2025",
    href: 'https://www.youtube.com/watch?v=GO4KWuxpWA0',
  },
  definition:
    'AI that guides a person through a physical task they were never trained to do, and makes them better at it as they work.',
  /** What each word is doing. */
  words: [
    {
      word: 'Physically grounded',
      means: 'It learns from the room in front of it, not from text on the web.',
    },
    { word: 'Agentic', means: 'It follows the task, decides when to speak, and asks when unsure.' },
    { word: 'Upskilling', means: 'The person does the work, and can do more than before.' },
  ],
  claims,
  /** How the group got here. */
  arc: [
    {
      when: '1985',
      title: 'A robot that could not help',
      body: 'The talk opens on an ad for a toy robot that promised to help with "the toughest challenges". Forty years on, little does better.',
    },
    {
      when: '2013',
      title: 'The kitchen',
      body: 'Cooking is procedural, messy, and full of ambiguity ("season to taste"): the ideal test bed. The group built YouCook and YouCook2.',
    },
    {
      when: '2022',
      title: 'MILLY',
      body: 'A DARPA-funded system that follows a cook through a recipe and flags a lapse the moment it happens.',
    },
    {
      when: 'Then',
      title: 'Battlefield medicine',
      body: 'The same guidance, moved to trauma assessment, pressure dressings, and chest seals.',
    },
    {
      when: '2025',
      title: 'The rural clinic',
      body: 'VIGIL: specialist-level exams, guided, wherever the patient is.',
    },
  ],
  close: 'Put the human-AI team in the arena, ground the AI in reality, not web corpora.',
} as const;
