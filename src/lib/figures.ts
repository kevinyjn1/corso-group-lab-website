/** Titles and text alternatives for the animated research figures in src/scripts/figures.ts. */
export const FIGURES = {
  video: {
    title: 'Supervoxel hierarchy',
    alt: 'Animation: a video frame divided into small regions that merge, step by step, into larger ones and then split again.',
  },
  language: {
    title: 'Dense video captioning',
    alt: 'Animation: the timeline of a cooking video. As the playhead reaches each step, the step is marked and described in a short sentence.',
  },
  robotics: {
    title: 'Following directions',
    alt: 'Animation: a robot seen from above moves through a room, sensing the obstacles ahead of it while it follows spoken directions.',
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
    title: 'Mistake attribution',
    alt: 'Animation: the instruction is "Grab a chain whip". A hand reaches across a bench and picks up a wrench. The mistake is then attributed three ways: what was wrong (the right action on the wrong object), when it became irreversible (the point of no return, 3.2 seconds in), and where (a box around the hand and the wrench).',
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
    title: 'The hazy oracle',
    alt: 'Animation: three mugs on a table, blue, orange, and green. A person says "Please fetch my mug." The robot rates each mug as equally likely, one in three, and asks the person to rephrase. The person says "It\'s the orange one." The robot\'s confidence in the orange mug rises to 96 percent and its gripper picks that mug up.',
  },
  health: {
    title: 'Echo guidance',
    alt: 'Animation: an ultrasound view of a beating heart, with tracked landmarks and a score for the quality of the view.',
  },
  learning: {
    title: 'Coreset selection',
    alt: 'Animation: data points gather into clusters, and a small, evenly spread subset of them is selected.',
  },
  vigil: {
    /** How long one telling takes, and when each of its steps begins, in seconds. */
    loop: 15,
    /** Who the console quotes, unless the figure names someone else as it goes. */
    speaker: 'VIGIL says',
    steps: [
      { at: 0.3, name: 'Line up' },
      { at: 2, name: 'Place the probe' },
      { at: 5.5, name: 'Correct' },
      { at: 8.8, name: 'Capture' },
      { at: 11.2, name: 'Report' },
    ],
    title: 'Guided ultrasound',
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
