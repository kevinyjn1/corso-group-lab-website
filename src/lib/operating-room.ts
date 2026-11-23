/**
 * The group's work on surgery and the heart, as four of its papers show it: the section "In the
 * operating room" on the home page. Each entry is a real figure, or one panel of one, cut from
 * the paper it names (an id in src/data/publications.yaml). Every line under `what` says only
 * what its paper says.
 *
 * Pictures of open surgery are left out on purpose: the hand tracking panel is the one frame of
 * its figure without a wound in view, and the tools are shown on training models.
 */
import type { ImageMetadata } from 'astro';
import heart from '../assets/papers/guo2026follow-fig2-a.jpg';
import hands from '../assets/papers/louis2023temporally-fig5-card.jpg';
import surface from '../assets/papers/ramey2004real-fig10.png';
import tools from '../assets/papers/sarikaya2017detection-fig6-card.jpg';

export interface Result {
  id: string;
  year: number;
  name: string;
  what: string;
  image: ImageMetadata;
  alt: string;
  /** The paper's id in src/data/publications.yaml. */
  paper: string;
  /** Which figure of the paper the picture is, or is cut from. */
  figure: string;
}

export const OPERATING_ROOM: readonly Result[] = [
  {
    id: 'surface',
    year: 2004,
    name: 'The beating heart',
    what: 'A point on the surface of a beating pig heart, followed in stereo video from a da Vinci endoscope. The blue line is its motion over eight seconds: the slow wave is breathing (red), and the spikes riding on it are heartbeats.',
    image: surface,
    alt: 'A graph of disparity against time, from 0 to 8 seconds. A smooth red dotted curve rises and falls twice. A blue line follows it, with regular sharp spikes.',
    paper: 'ramey2004real',
    figure: 'From Figure 10',
  },
  {
    id: 'tools',
    year: 2017,
    name: "The robot's tools",
    what: "The instruments of a da Vinci surgical robot, found frame by frame in video of surgeons at their training tasks. Each red box carries the detector's score.",
    image: tools,
    alt: 'Four video frames of robotic surgical instruments working on training models: a suturing pad and a ring on a peg board. A red box labeled tool, with a score near 1.000, is drawn around each instrument tip.',
    paper: 'sarikaya2017detection',
    figure: 'From Figure 6',
  },
  {
    id: 'hands',
    year: 2023,
    name: "The surgeon's hands",
    what: 'Every hand in the video gets a box, an identity that persists, and 21 joints, each new estimate guided by the frames before.',
    image: hands,
    alt: 'A frame of surgical video with two hands in green gloves. Each hand is in a white box, with its fingers traced as colored lines from the wrist.',
    paper: 'louis2023temporally',
    figure: 'From Figure 5',
  },
  {
    id: 'heart',
    year: 2026,
    name: 'The heart, by ultrasound',
    what: "Landmarks along the wall of the left ventricle in a heart ultrasound: the model's in red, the reference labels in yellow. From landmarks like these the system scores how well the probe is placed.",
    image: heart,
    alt: 'An ultrasound image of a heart. Yellow dots and red crosses, nearly on top of one another, trace the outline of the left ventricle, with a few more at the valves. A legend reads: ground truth labels, predicted labels.',
    paper: 'guo2026follow',
    figure: 'From Figure 2',
  },
];
