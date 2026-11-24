/**
 * Figures taken from the group's own papers, shown as they were published.
 *
 * Each entry names its paper (the name of its file in the content's publications/ folder) and the figure's number in
 * that paper. The caption says only what the paper's own caption and text say. The images are
 * cut from the papers at print resolution and live in src/assets/papers.
 */
import type { ImageMetadata } from 'astro';
import agent from '../assets/papers/bellos2025effective-fig1-photos.jpg';
import tumor from '../assets/papers/corso2008efficient-fig6.jpg';
import hsr from '../assets/papers/griffin2020video-fig19.jpg';
import labels from '../assets/papers/griffin2026label-fig1.jpg';
import ivln from '../assets/papers/krantz2023iterative-fig1.jpg';
import bimotion from '../assets/papers/wang2026bimotion-fig4.jpg';
import supervoxels from '../assets/papers/xu2012streaming-fig6.jpg';
import a2d from '../assets/papers/xu2015humans-fig1.jpg';
import youcook2 from '../assets/papers/zhou2018automatic-fig1.jpg';
import grounded from '../assets/papers/zhou2019grounded-fig1.jpg';

export interface PaperFigure {
  /** The paper's id: the name of its file in the content's publications/ folder. */
  paper: string;
  /** The figure's own number in the paper. */
  label: string;
  /** Set when the image is a part of that figure, cut so that it reads at the size shown. */
  part?: boolean;
  image: ImageMetadata;
  /** What the figure shows, for people who cannot see it. */
  alt: string;
  /** What to notice, in plain words. */
  caption: string;
  /** Credits the paper itself gives for material inside the figure. */
  credit?: string;
}

export const PAPER_FIGURES = {
  supervoxels: {
    paper: 'xu2012streaming',
    label: 'Figure 6',
    image: supervoxels,
    alt: 'Ten frames of a street video of a violinist, numbered 1 to 901, in four rows. The top row is the video itself. In the three rows below, every frame is divided into colored regions: many small ones in the second row, fewer and larger ones in the third, and the fewest in the last.',
    caption:
      'A 30-second street video (top row), segmented at the 5th, 10th, and 14th layers of a hierarchy. The method works through the video as a stream: each frame is processed once, and the whole video is never held in memory.',
  },
  a2d: {
    paper: 'xu2015humans',
    label: 'Figure 1',
    image: a2d,
    alt: 'A grid of video frames, each beside the same frame with colored shapes over the things in it and labels such as adult climbing, dog walking, baby crawling, bird flying, ball rolling, and car jumping.',
    caption:
      'Labeled videos from A2D, each marked with who is acting and what they are doing: "adult climbing", "dog walking", "bird flying".',
  },
  grounded: {
    paper: 'zhou2019grounded',
    label: 'Figure 1',
    image: grounded,
    alt: 'Two video segments, three frames each. Under the first is the sentence: A man is seen standing in a room speaking to the camera while holding a bike. The words man, room, and bike are boxed, and a line joins each to a green box in one of the frames. Under the second: A group of people are in a raft down a river, with people, raft, and river boxed and joined to the frames in the same way. Under each sentence are three other descriptions of the same segment.',
    caption:
      'The model wrote each sentence for a video segment, and tied every boxed word to the part of the frame it names. Under each: the same model trained without boxes, an earlier method, and a description written by a person (GT).',
  },
  youcook2: {
    paper: 'zhou2018automatic',
    label: 'Figure 1',
    image: youcook2,
    alt: 'A timeline of one cooking video, cut into eight steps with start and end times. Under each step is a frame and a sentence, such as: Grill the tomatoes in a pan and then put them on a plate; Cook bacon until crispy, then drain on paper towel; Place the bacon at the top.',
    caption:
      'One video from YouCook2: making a BLT sandwich, cut into eight steps, each with its start and end time and a sentence.',
  },
  ivln: {
    paper: 'krantz2023iterative',
    label: 'Figure 1',
    image: ivln,
    alt: 'Five panels from one tour of a house: episode 1 of 82, the oracle step that follows it, episode 2, episode 6, and episode 82. Each panel has a map of the tour with the paths walked so far in blue, a map of the parts of the house observed so far, the written instruction for that episode, and the view the agent starts from. The map of what has been observed is almost empty in the first panel and shows the whole floor plan in the last.',
    caption:
      'One tour of a house, in 82 instructions. After each attempt an oracle guides the agent to the correct goal, then to the start of the next path. Agents usually begin every instruction with no memory. This one keeps its memory, and its map of the house fills in as the tour goes on.',
  },
  hsr: {
    paper: 'griffin2020video',
    label: 'Figure 19',
    image: hsr,
    alt: 'Nine photographs, in three rows, of a Toyota HSR robot beside a metal tray of small objects, a wooden shelf, and a bin, under a Michigan Robotics sign. The robot looks down at the tray, lowers its arm, grasps a banana peel, lifts it clear, and places it in the bin.',
    caption:
      'A Toyota HSR robot clears a tray. It finds the objects with the camera in its hand (top row), centers on a banana peel and grasps it (middle row), then checks the grasp away from the other objects and places the peel in the bin (bottom row). Each move is guided by segmenting the object in video.',
  },
  agent: {
    paper: 'bellos2025effective',
    label: 'Figure 1',
    part: true,
    image: agent,
    alt: "Two photographs and part of a conversation. In the first photograph a person applies a tourniquet to the arm of a training manikin in uniform. The second shows the same task as the person's headset sees it. The conversation reads. Agent: Place tourniquet over affected extremity 2-3 inches above wound site. Let me know when you're finished. Human: Ok I did it. what's next. Agent: Pull tourniquet tight. Human: How tight should I pull?",
    caption:
      'An AI agent guides a person through applying a tourniquet. The person does the task with their own hands and talks with the agent, which reaches them through an AR headset.',
  },
  tumor: {
    paper: 'corso2008efficient',
    label: 'Figure 6',
    image: tumor,
    alt: 'Four rows of twelve brain MRI slices from one patient. In every slice the tumor is marked in green and the edema around it in red. The rows are labeled a to d.',
    caption:
      "One patient's brain tumor, slice by slice: tumor in green, edema in red. Row (a) was labeled by hand. Rows (b) and (c) are two other automatic methods, and row (d) is the paper's.",
  },
  labels: {
    paper: 'griffin2026label',
    label: 'Figure 1',
    image: labels,
    alt: 'Pairs of photographs from several object detection datasets, each with a box and a label that a model proposed. In the top row, framed in red and marked Reject, the labels do not fit: a tomato labeled apple, a snow-covered hydrant labeled snowman. In the row below, framed in green and marked Accept, the same labels fit: an apple cut in half, a snowman. Under the photographs is a diagram: pseudo-label tokens go to a judge, the Turing Test Network, which marks each one accept or reject.',
    caption:
      'Labels proposed by a model, and the judge that prunes them. A single network, trained only on image classification, rejects the labels framed in red (a tomato called an apple, a snow-covered hydrant called a snowman) and accepts those in green, across several detection datasets and labeling models.',
  },
  bimotion: {
    paper: 'wang2026bimotion',
    label: 'Figure 4',
    image: bimotion,
    alt: 'Four 3D characters: a robot, a robot with a television for a head, a moose, and a tiger. Each sits beside the sentence that describes its motion, for example: The tiger leaps forward and snaps its head to the right to bite something. Below, each character is shown at three moments in time in four columns, one per method. Red circles mark flaws in the first three columns. The last column is labeled Ours.',
    caption:
      'A 3D character and a sentence go in, and its motion comes out. Each character is shown at three moments, as animated by three other methods and by BiMotion (last column). Red circles mark artifacts in the others.',
  },
} as const satisfies Record<string, PaperFigure>;

export type PaperFigureName = keyof typeof PAPER_FIGURES;
