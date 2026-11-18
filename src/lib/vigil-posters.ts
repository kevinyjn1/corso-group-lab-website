/**
 * What each team showed at the VIGIL demo day in the summer of 2026, taken from the posters as
 * the group photographed them. Where the work has been published, `href` is the paper and the
 * title and authors are as published; otherwise they are as printed on the poster.
 *
 * Summaries are in this site's words. A number is only quoted if the poster states it.
 */
export interface Poster {
  title: string;
  /** Who presented it. */
  team: string;
  people: string;
  what: string;
  /** One result the poster states, if it has one that stands alone. */
  result?: { value: string; label: string };
  /** The published paper, if there is one, and where it appeared. */
  href?: string;
  venue?: string;
}

/** The parts of the system itself. */
export const SYSTEM_POSTERS: readonly Poster[] = [
  {
    title: 'Deep Vein Detection, Tracking, and Compression Guidance',
    team: 'Colorado State University',
    people:
      'Animesh Gurjar, Sheikh Mannan, Mahjabin Oishe, Sifat Anindho, Sadaf Ghaffari, Jack Fitzgerald, Bruce Draper, Nikhil Krishnaswamy',
    what: 'Guides a generalist through every step of a leg scan for blood clots. It tracks the vein in the ultrasound image and the probe and the body in the room, turns that into simple directions relative to the patient, and projects them onto the leg.',
  },
  {
    title: 'Guiding Echocardiography with Flow Matching',
    team: 'University of Pennsylvania',
    people:
      'T. Chan, K. Chan, J. Dong, J. Hao, Z. Guo, Y. Fang, E. Zhang, J. Corso, E. MacKay, C. Rajapakse, A. Pouch',
    what: 'Treats finding a view of the heart as moving the probe along a learned flow of positions and angles, and tells the operator which way to go next, for six standard views.',
    result: {
      value: '37%',
      label: 'Faster to a clip of comparable quality, for novice and intermediate operators',
    },
  },
  {
    title: 'Patient-Aware 3D Scene Reconstruction for VIGIL Clinical Guidance',
    team: 'Stevens Institute of Technology',
    people: 'Junze Liu, Yi Li, Juan Carlos Dibene Simental, Enrique Dunn',
    what: 'Rebuilds the patient and the room in three dimensions from a color camera and a depth camera: a body mesh for the patient and a point cloud for the room, fused into one scene that guidance can be placed in.',
  },
  {
    title: 'VIGIL Dense Activity Captioning and Progress Estimation',
    team: 'Northeastern University',
    people: 'Gerard Donahue, David Zhang, Truong Vu, ShihPo Lee, Ehsan Elhamifar',
    what: 'A streaming vision-language model with open weights, run locally, writes a clinically grounded caption for each moment of a procedure and can show the documents behind it. A second model says how much of each vein in the thigh has been scanned, and how far along the exam is.',
  },
  {
    title: 'Task-on-Demand VQA: An Agentic Framework',
    team: 'University of Michigan, Corso Group',
    people: 'Filippos Bellos, Yayuan Li, Andrew Krikorian, Jason J. Corso',
    what: 'Name a procedure, and an agent builds a model that can answer questions about it. It finds narrated videos on the web, transcribes and filters them, and turns them into captions and questions at three levels of detail. The first test was endotracheal intubation.',
    result: {
      value: '28.2% to 53.7%',
      label: 'Accuracy on intubation questions, from the base model to the one the agent built',
    },
  },
  {
    title: 'Multimodal Grounded Report Generation',
    team: 'University of Rochester',
    people: 'Susan Liang, Dongdong Nian, Chenliang Xu',
    what: 'Writes the report after the exam from the ultrasound video and the conversation in the room. Each finding is linked to the stretch of video that supports it, so a clinician can check it with a click.',
  },
  {
    title: 'Probe Tip Tracking',
    team: 'University of Michigan and Cornell Tech',
    people: 'Ayush Shrivastava, Sanyam Mehta, Daniel Geng, Andrew Owens',
    what: 'Predicts where the tip of the ultrasound probe is in three dimensions, from color and depth images, so that the system knows where the probe is when it tells the user where to move it.',
  },
  {
    title:
      'Flout at Your Own Risk: LLMs Struggle with Pragmatic Cooperativity Under Epistemic Asymmetry',
    team: 'Colorado State University',
    people: 'Hannah VanderHoeven, Abhijnan Nath, Nikhil Krishnaswamy',
    what: 'How should a guide that knows more say what it knows? A study of language models as speakers and listeners when each party holds part of the picture, aimed at a VIGIL that shares the right information and asks for what it lacks.',
    href: 'https://arxiv.org/abs/2607.11053',
    venue: 'arXiv 2026',
  },
];

/** Research from the same groups that was shown alongside. */
export const RELATED_POSTERS: readonly Poster[] = [
  {
    title:
      'Substantial, Decomposable, and Invisible: Visual Context Misalignment in Instructional Videos for Physical Tasks',
    team: 'University of Michigan, Corso Group',
    people: 'Yayuan Li, Chenglin Li, Jingying Wang, Filippos Bellos, Anhong Guo, Jason J. Corso',
    what: "Instructional videos rarely match the room the learner is standing in. In a lab study of two first-aid and two cooking tasks, videos recorded to match each learner's own setup beat popular web videos, taking the four tasks together.",
    result: { value: '+11.1%', label: 'In quality of the finished task, and 15.5% less time' },
    href: 'https://arxiv.org/abs/2605.17184',
    venue: 'arXiv 2026',
  },
  {
    title: 'AdaTurn: Budget-Aware Test-Time Scaling for Active Visual Perception Agents',
    team: 'University of Rochester and University of Michigan',
    people: 'Susan Liang, Chao Huang, Filippos Bellos, Jing Bi, Jason J. Corso, Chenliang Xu',
    what: 'An agent that looks closer at an image over several turns, trained to give its best answer when its turns run out instead of being cut off without one.',
    href: 'https://arxiv.org/abs/2607.14547',
    venue: 'arXiv 2026',
  },
  {
    title: 'Point Prompting: Counterfactual Tracking with Video Diffusion Models',
    team: 'University of Michigan and Cornell Tech',
    people: 'Ayush Shrivastava, Sanyam Mehta, Daniel Geng, Andrew Owens',
    what: 'Mark a point in a video with a colored dot, and a video diffusion model carries the dot forward: point tracking from a model that was never trained to track.',
    href: 'https://arxiv.org/abs/2510.11715',
    venue: 'ICLR 2026',
  },
  {
    title:
      'HandProxy: Expanding the Affordances of Speech Interfaces in Immersive Environments with a Virtual Proxy Hand',
    team: 'University of Michigan and Microsoft Research',
    people: 'Chen Liang, Yuxuan Liu, Martez Mott, Anhong Guo',
    what: 'Say what you want done, and a virtual hand does it. Speech becomes a way to perform the hand interactions that immersive environments expect.',
    result: {
      value: '91.8%',
      label: 'Of spoken commands carried out correctly, with 20 participants',
    },
    href: 'https://arxiv.org/abs/2503.10029',
    venue: 'IMWUT 2025',
  },
  {
    title: 'WorldScribe: Towards Context-Aware Live Visual Descriptions',
    team: 'University of Michigan',
    people: 'Ruei-Che Chang, Yuxuan Liu, Anhong Guo',
    what: 'Live descriptions of the world for blind users that adapt to what the user is doing and to the sights and sounds around them. Shown with EditScribe, which makes image editing possible without sight.',
    href: 'https://arxiv.org/abs/2408.06627',
    venue: 'UIST 2024, Best Paper',
  },
];
