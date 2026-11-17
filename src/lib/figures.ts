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
    title: 'Catching a mistake',
    alt: 'Animation: an assistant follows a five step task, flags a mistake at the third step, asks a question, and carries on once it is corrected.',
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
    title: 'Guided ultrasound',
    alt: 'Animation: a patient lies on an exam table, seen from above. Light projected onto the chest marks where an ultrasound probe should go. A clinician brings the probe in, a voice says which way to tilt it, and the ultrasound image beside the table sharpens into a four-chamber view of the heart as the probe reaches the mark.',
  },
  leg: {
    title: 'Guided leg scan',
    alt: "Animation: a patient's legs seen from above. Green marks projected along one thigh show the path of a vein. A clinician moves an ultrasound probe along it, pressing at each mark, while the ultrasound image beside the table shows the vein flatten under the probe. Three bars fill as the three veins are scanned, and the exam ends with a report.",
  },
} as const;

export type FigureName = keyof typeof FIGURES;
