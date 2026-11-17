/**
 * The four readings of the scene on the home page, each with the published work of the group
 * that it illustrates. The scene itself is in src/scripts/hero-scene.ts.
 *
 * Every line under `what` says only what its paper says. The papers were read in November 2026.
 */
export const READINGS = [
  {
    id: 'hands',
    label: 'Hands',
    what: 'Every hand in the video gets a box, a side, an identity that persists, and 21 joints, followed from frame to frame.',
    paper: 'Temporally Guided Articulated Hand Pose Tracking in Surgical Videos',
    venue: 'IJCARS 2023',
    href: 'https://arxiv.org/abs/2101.04281',
  },
  {
    id: 'language',
    label: 'Language',
    what: 'What each thing is, which step this is, and answers to questions about it: SurgAtlas pairs 2,391 hours of open and minimally invasive surgery with language.',
    paper: 'SurgAtlas: A Large-Scale Surgical Video-Language Dataset',
    venue: 'arXiv 2026',
    href: 'https://arxiv.org/abs/2606.25905',
  },
  {
    id: 'surface',
    label: 'Surface',
    what: 'The surface of a beating heart, followed in stereo video as it deforms, toward a steadied view for robot-assisted bypass surgery.',
    paper: 'Stereo-Based Endoscopic Tracking of Cardiac Surface Deformation',
    venue: 'MICCAI 2004',
    href: 'https://doi.org/10.1007/978-3-540-30136-3_61',
  },
  {
    id: 'motion',
    label: 'Motion',
    what: 'Economy of motion, from the path of the suturing hand and of the other hand: the measure planned for a study of 506 bypass operations at six hospitals.',
    paper:
      'Novel Assessments of Technical and Nontechnical Cardiac Surgery Quality: Protocol for a Mixed Methods Study',
    venue: 'JMIR Research Protocols 2021',
    href: 'https://doi.org/10.2196/22536',
  },
] as const;

export type ReadingId = (typeof READINGS)[number]['id'];
