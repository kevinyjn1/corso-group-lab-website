/**
 * Titles and text alternatives for the animated research figures in src/scripts/figures.ts.
 *
 * Every figure illustrates a published result of the group, and `after` names it: the ids of the
 * papers in src/data/publications.yaml that the figure is drawn after. A figure with no paper to
 * name does not belong on the site. The two VIGIL figures are drawn from the project's public
 * descriptions instead, and the VIGIL page says so beside them.
 */
export const FIGURES = {
  video: {
    after: ['xu2012streaming'],
    title: 'Supervoxel hierarchy',
    alt: 'Animation: a video frame divided into small regions that merge, step by step, into larger ones and then split again.',
  },
  language: {
    after: ['zhou2018end'],
    title: 'Dense video captioning',
    alt: 'Animation: the timeline of a cooking video. As the playhead reaches each step, the step is marked and described in a short sentence.',
  },
  robotics: {
    after: ['krantz2023iterative'],
    title: 'A tour of instructions',
    alt: 'Animation: a navigation agent, seen from above, follows a series of written instructions through one room, one after another. What it has seen so far stays lit, so each new instruction starts from what it already knows.',
  },
  human: {
    loop: 14.5,
    speaker: 'Instruction',
    steps: [
      { at: 0.4, name: 'Watch' },
      { at: 6.6, name: 'What' },
      { at: 8.6, name: 'When' },
      { at: 10.6, name: 'Where' },
    ],
    after: ['li2026mistake'],
    title: 'Mistake attribution',
    alt: 'Animation of the example in Figure 1 of the paper: the instruction is "Pick up hammer". A hand reaches across a bench, past a hammer, and picks up a bolt. The mistake is then attributed three ways: what was wrong (the right action on the wrong object), when it became irreversible (the point of no return, frame 17), and where (a box around the hand and the bolt).',
  },
  oracle: {
    loop: 14,
    speaker: 'Person',
    steps: [
      { at: 0.4, name: 'Ask' },
      { at: 2.2, name: 'Weigh' },
      { at: 4.4, name: 'Ask again' },
      { at: 6.8, name: 'Rephrase' },
      { at: 9.6, name: 'Fetch' },
    ],
    after: ['lemmer2023evaluating'],
    title: 'The hazy oracle',
    alt: 'Animation of the example in Figure 1 of the paper: three mugs on a table, green, red, and orange. A person says "Please fetch my mug from the table." The robot rates the three mugs as equally likely and says "I\'m not sure. Can you try again?" The person says "Get the orange one." Only the orange mug still fits the request, and the gripper picks it up.',
  },
  health: {
    after: ['guo2026follow'],
    title: 'Echo guidance',
    alt: "Animation: a handheld ultrasound view of a beating heart, with all four chambers in view. Landmarks on the left ventricle are tracked through each beat, and the probe's position is rated as on target or close to target.",
  },
  learning: {
    after: ['griffin2026zero'],
    title: 'Coreset selection',
    alt: 'Animation: unlabeled images appear as points in an embedding space. Random spots in the space are sampled again and again. The point nearest each spot gains a score, its close neighbors lose a little, and the highest-scoring points become a small, spread-out training subset.',
  },
  vigil: {
    /** How long one telling takes, and when each of its steps begins, in seconds. */
    loop: 15,
    /** Who the console quotes, unless the figure names someone else as it goes. */
    speaker: 'VIGIL says',
    steps: [
      { at: 0.3, name: 'Line up' },
      { at: 2, name: 'Place' },
      { at: 5.5, name: 'Correct' },
      { at: 8.8, name: 'Capture' },
      { at: 11.2, name: 'Report' },
    ],
    title: 'Guided heart exam',
    alt: 'Animation: a patient lies on an exam table, seen from above. Light projected onto the chest marks where an ultrasound probe should go. A clinician brings the probe in, a voice says which way to tilt it, and the ultrasound image beside the table sharpens into a four-chamber view of the heart as the probe reaches the mark.',
  },
  leg: {
    loop: 17,
    speaker: 'VIGIL says',
    steps: [
      { at: 0.3, name: 'Line up' },
      { at: 1.8, name: 'Groin' },
      { at: 5.2, name: 'Thigh' },
      { at: 11.2, name: 'Knee' },
      { at: 13.6, name: 'Report' },
    ],
    title: 'Guided leg scan',
    alt: "Animation: a patient's legs seen from above. Green marks projected along one thigh show the path of a vein. A clinician moves an ultrasound probe along it, pressing at each mark, while the ultrasound image beside the table shows the vein flatten under the probe. Three bars fill as the three veins are scanned, and the exam ends with a report.",
  },
} as const;

export type FigureName = keyof typeof FIGURES;
