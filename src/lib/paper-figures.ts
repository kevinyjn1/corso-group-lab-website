/**
 * Figures taken from the group's own papers, shown as they were published.
 *
 * Each entry names its paper (an id in src/data/publications.yaml) and the figure's number in
 * that paper. The caption says only what the paper's own caption and text say. The images are
 * cut from the papers at print resolution and live in src/assets/papers.
 */
import type { ImageMetadata } from 'astro';
import robotslang from '../assets/papers/banerjee2021robotslang-fig1.jpg';
import zcore from '../assets/papers/griffin2026zero-fig1.jpg';
import followYourHeart from '../assets/papers/guo2026follow-fig1.png';
import hazyOracle from '../assets/papers/lemmer2023evaluating-fig1.png';
import mistake from '../assets/papers/li2026mistake-fig1.jpg';
import clickHere from '../assets/papers/szeto2017click-fig1.jpg';
import a2d from '../assets/papers/xu2015humans-fig1.jpg';
import youcook2 from '../assets/papers/zhou2018automatic-fig1.jpg';

export interface PaperFigure {
  /** The paper's id in src/data/publications.yaml. */
  paper: string;
  /** The figure's own number in the paper. */
  label: string;
  image: ImageMetadata;
  /** What the figure shows, for people who cannot see it. */
  alt: string;
  /** What to notice, in plain words. */
  caption: string;
  /** Credits the paper itself gives for material inside the figure. */
  credit?: string;
}

export const PAPER_FIGURES = {
  oracle: {
    paper: 'lemmer2023evaluating',
    label: 'Figure 1',
    image: hazyOracle,
    alt: 'A drawing in two parts. A person tells a robot: Please fetch my mug from the table. Three mugs are on the table. Under standard inference, the robot rates the three mugs as equally likely and picks the green one. Under deferred inference, the robot says: I am not sure, can you try again? The person says: Get the orange one. The robot holds the orange mug.',
    caption:
      'The idea, as the paper draws it. Asked to "fetch my mug" with three mugs on the table, a model that takes the request as complete has to guess. One that treats the person as a hazy oracle asks again.',
    credit:
      'Robot image from Wikimedia Commons (CC-SA) and mug images from freepik.com, as the paper credits them.',
  },
  mistake: {
    paper: 'li2026mistake',
    label: 'Figure 1',
    image: mistake,
    alt: 'Three first-person video frames of hands at a workbench, beside a bar chart of the probability that each frame is the point of no return. The instruction text reads: Pick up hammer. Three labels follow. What: the predicate "Pick up" is right and the object "hammer" is marked in red. When: point of no return, frame 17. Where: a red box drawn over the hand in the frame.',
    caption:
      'The task, as the paper draws it. The instruction is "Pick up hammer", and the person picks up a bolt. The attribution names what was violated (the object), when the attempt passed the point of no return (frame 17), and where in the frame (the red box).',
  },
  video: {
    paper: 'xu2015humans',
    label: 'Figure 1',
    image: a2d,
    alt: 'A grid of video frames, each beside the same frame with colored shapes over the things in it and labels such as adult climbing, dog walking, baby crawling, bird flying, ball rolling, and car jumping.',
    caption:
      'Labeled videos from A2D, the group\'s dataset of 3,782 YouTube videos marked pixel by pixel with who is acting and what they are doing: "adult climbing", "dog walking", "bird flying".',
  },
  language: {
    paper: 'zhou2018automatic',
    label: 'Figure 1',
    image: youcook2,
    alt: 'A timeline of one cooking video, cut into eight steps with start and end times. Under each step is a frame and a sentence, such as: Grill the tomatoes in a pan and then put them on a plate; Cook bacon until crispy, then drain on paper towel; Place the bacon at the top.',
    caption:
      'One video from YouCook2: making a BLT sandwich, with every step timed and described in a sentence. The dataset holds 2,000 cooking videos of 89 recipes, 176 hours in all.',
  },
  robotics: {
    paper: 'banerjee2021robotslang',
    label: 'Figure 1',
    image: robotslang,
    alt: 'Two screens joined by a web server, and a photograph of a small wheeled robot. The commander view shows a map of a maze from above and a picture of the next object to find. The driver view shows what the robot camera sees and the keys that steer it. Both have a chat window.',
    caption:
      "RobotSlang. The commander sees a map and guides by text chat. The driver sees only the robot's camera and steers it through a tabletop maze. The benchmark holds 169 such trials.",
  },
  human: {
    paper: 'szeto2017click',
    label: 'Figure 1',
    image: clickHere,
    alt: "Two diagrams of a network estimating which way a red taxi faces. With the image alone, the estimate has two peaks, 180 degrees apart. With the image and a person's click on the back left wheel, marked by a star, the estimate has one sharp peak.",
    caption:
      'Click-Here CNN. From the image alone, the network cannot tell which way the taxi faces: its estimate has two peaks. One click from a person, on the back left wheel, leaves one.',
  },
  health: {
    paper: 'guo2026follow',
    label: 'Figure 1',
    image: followYourHeart,
    alt: 'Part A: a pipeline from an ultrasound video, through a landmark detector and a pose estimator that frames each image green, yellow, or red, to an estimator of ejection fraction that takes the green ones. Part B: a drawing of a probe on a chest, and six ultrasound frames in a strip that runs from green, on target, through yellow, close to target, to red, off target.',
    caption:
      "A: landmarks are found in each ultrasound frame, the probe's position is scored from them, and the views scored green go on to an automated estimate of ejection fraction. B: a sweep away from the best position, scored on target, close to target, and off target.",
  },
  learning: {
    paper: 'griffin2026zero',
    label: 'Figure 1',
    image: zcore,
    alt: 'A pipeline in four stages: unlabeled images are turned into points in a high-dimensional space by a foundation model, the space is sliced into subspaces again and again, points are sampled to cover it without repeating one another, and a small set of images is chosen.',
    caption:
      'ZCore chooses which images are worth training on without a single label. It embeds them with foundation models, then samples that space for coverage while penalizing redundancy.',
  },
} as const satisfies Record<string, PaperFigure>;

export type PaperFigureName = keyof typeof PAPER_FIGURES;
