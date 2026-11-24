/**
 * What each research area is shown by. Everything here is real: a figure from one of the group's
 * papers (src/lib/paper-figures.ts), or a clip of the group's own footage (src/assets/clips).
 *
 * - `lead` opens the area on the Research page, at full width.
 * - `second` sits beside the area's text there.
 * - `card` is the picture on the area's card on the home page: a part of one figure, cut so that
 *   it reads at a small size.
 */
import type { ImageMetadata } from 'astro';
import mistakeResults from '../assets/clips/mistake-results-wide.mp4';
import viewScoring from '../assets/clips/vigil-view-scoring.mp4';
import mistakePoster from '../assets/clips/posters/mistake-results-wide.jpg';
import viewScoringPoster from '../assets/clips/posters/vigil-view-scoring.jpg';
import agentCard from '../assets/papers/bellos2025effective-fig1-card.jpg';
import tumorCard from '../assets/papers/corso2008efficient-fig6-card.jpg';
import hsrCard from '../assets/papers/griffin2020video-fig19-card.jpg';
import labelsCard from '../assets/papers/griffin2026label-fig1-card.jpg';
import supervoxelsCard from '../assets/papers/xu2012streaming-fig6-card.jpg';
import groundedCard from '../assets/papers/zhou2019grounded-fig1-card.jpg';
import type { PaperFigureName } from './paper-figures';

export interface AreaClip {
  src: string;
  poster: ImageMetadata;
  /** The tag in the corner of the clip. */
  tag: string;
  /** Where the pause button sits. See src/components/Clip.astro. */
  toggle?: 'left' | 'right' | 'top';
  alt: string;
  /** The first words of the caption, set in bold. */
  title: string;
  caption: string;
  /** Where the footage is from, and the link that goes there. */
  source: { label: string; paper?: string; href?: string };
}

export interface AreaCard {
  image: ImageMetadata;
  alt: string;
  /** The figure this is a part of. */
  figure: PaperFigureName;
}

interface AreaVisual {
  lead: { figure: PaperFigureName } | { clip: AreaClip };
  second: PaperFigureName;
  card: AreaCard;
}

export const AREA_VISUALS = {
  video: {
    lead: { figure: 'supervoxels' },
    second: 'a2d',
    card: {
      image: supervoxelsCard,
      figure: 'supervoxels',
      alt: 'Five frames of a street video of a violinist, and under each the same frame divided into colored regions at three levels: many small regions, then fewer, then a few large ones.',
    },
  },
  language: {
    lead: { figure: 'grounded' },
    second: 'youcook2',
    card: {
      image: groundedCard,
      figure: 'grounded',
      alt: 'Two rows of three video frames. Under the first row is the sentence: A man is seen standing in a room speaking to the camera while holding a bike. Under the second: A group of people are in a raft down a river. In each sentence three words are boxed, and a line joins each to a green box in one of the frames.',
    },
  },
  robotics: {
    lead: { figure: 'ivln' },
    second: 'hsr',
    card: {
      image: hsrCard,
      figure: 'hsr',
      alt: 'A Toyota HSR robot in a lab, under a Michigan Robotics sign, reaching its arm down to a metal tray of small objects beside a wooden shelf.',
    },
  },
  human: {
    lead: {
      clip: {
        src: mistakeResults,
        poster: mistakePoster,
        tag: 'Model output',
        toggle: 'top',
        alt: 'Four first-person video clips of people doing household tasks, each over an instruction such as: picks the scraper, moves the bowl, places the bottle. As each attempt goes wrong, the clip stops, a colored heat map and a red box mark a region of the frame, the word Detected appears, and the words of the instruction turn red or green with a cross or a check.',
        title: 'The model on real first-person video.',
        caption:
          'When it detects a mistake, it marks where in the frame (the box), when (the time under the clip), and which part of the instruction was not followed: the action, the object, or both (red). The videos are from public research datasets.',
        source: {
          label: "From the group's video of Li et al., CVPR 2026",
          href: 'https://yayuanli.github.io/MATT/',
        },
      },
    },
    second: 'agent',
    card: {
      image: agentCard,
      figure: 'agent',
      alt: 'Two hands tighten a tourniquet on the arm of a training manikin in uniform, which lies on a workbench in a lab.',
    },
  },
  health: {
    lead: {
      clip: {
        src: viewScoring,
        poster: viewScoringPoster,
        tag: 'Footage',
        toggle: 'left',
        alt: 'Two copies of a live ultrasound of the heart. The left is plain. On the right, dots trace the wall of the left ventricle, a frame around the image changes between green, yellow, and red, and a reading of LVEF, near 62 percent, updates.',
        title: 'Reading a heart ultrasound as it arrives.',
        caption:
          "Left, the ultrasound from a handheld probe. Right, landmarks traced on the heart, a frame that turns green, yellow, or red as the probe is on, near, or far from the four-chamber view, and an estimate of ejection fraction (LVEF), the share of the left ventricle's blood pumped out with each beat.",
        source: { label: 'The system of Guo et al., ISBI 2026', paper: 'guo2026follow' },
      },
    },
    second: 'tumor',
    card: {
      image: tumorCard,
      figure: 'tumor',
      alt: 'Four rows of brain MRI slices from one patient, with the tumor marked in green and the edema around it in red in every slice.',
    },
  },
  learning: {
    lead: { figure: 'labels' },
    second: 'bimotion',
    card: {
      image: labelsCard,
      figure: 'labels',
      alt: 'Pairs of photographs with boxes and labels. Framed in red: a tomato labeled apple, a snow-covered hydrant labeled snowman. Framed in green below them: an apple cut in half labeled apple, a snowman labeled snowman.',
    },
  },
} as const satisfies Record<string, AreaVisual>;

export type AreaId = keyof typeof AREA_VISUALS;
