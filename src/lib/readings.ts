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
    what: 'Every hand in the video gets a box, an identity that persists, and 21 joints, each new estimate guided by the frames before.',
    paper: 'Temporally Guided Articulated Hand Pose Tracking in Surgical Videos',
    venue: 'IJCARS 2023',
    href: 'https://arxiv.org/abs/2101.04281',
  },
  {
    id: 'language',
    label: 'Language',
    what: 'What each thing is, which step this is, and answers to questions about it: SurgAtlas pairs 15,291 public surgical videos across 18 specialties with captions, step descriptions, summaries, and questions.',
    paper:
      'SurgAtlas: A Large-Scale Surgical Video-Language Dataset with 2,391 Hours of Open and Minimally Invasive Surgery',
    venue: 'arXiv 2026',
    href: 'https://arxiv.org/abs/2606.25905',
  },
  {
    id: 'surface',
    label: 'Surface',
    what: 'The surface of a beating heart, followed in stereo video as it deforms. On video of a pig heart from a da Vinci stereo endoscope, the tracker picked up both the heartbeat and the breathing. The aim was a steadied view for robot-assisted bypass surgery.',
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
