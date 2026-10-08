// The end-to-end journey of building a home in Pakistan, in order. Each stage
// has one colour; each step lists what to do, what to collect, and (where
// Siraat has a tool for it) a link. Step 11 expands into the site-order build
// roadmap from buildPhases.ts so the two never drift apart.
//
// Fees, tax rates and authority rules differ by society and city and change
// often, so this guide names WHAT to ask for, not amounts. Confirm current
// figures with your society office and the relevant authority.

export interface JourneyLink {
  label: string;
  href: string;
}

export interface JourneyStep {
  id: string;
  title: string;
  summary: string;
  tasks: string[];
  links?: JourneyLink[];
  // Steps the founder's brief did not list but which are needed in practice.
  added?: boolean;
}

export interface JourneyStage {
  key: string;
  title: string;
  color: string;
  tint: string;
  ink: string;
  steps: JourneyStep[];
}

export const BUILD_JOURNEY: JourneyStage[] = [
  {
    key: 'BUY',
    title: 'Buy the right plot',
    color: '#7c3aed',
    tint: '#f5f3ff',
    ink: '#4c1d95',
    steps: [
      {
        id: 'find-plot',
        title: 'Find a plot',
        summary: 'Browse plots for sale and shortlist the ones that fit your budget and size.',
        tasks: ['Set a total budget that also covers transfer costs and construction', 'Shortlist 3 to 5 plots and visit each one'],
        links: [{ label: 'Plots for sale', href: '/plots' }],
      },
      {
        id: 'verify-plot',
        title: 'Finalise the plot: check the ground and the papers',
        summary: 'Filled or soft land can add lakhs to the foundation. Check what owners reported for this plot number and its neighbours before you pay.',
        tasks: [
          'See the ground report for your block and plot: solid, filled or mixed',
          'Check the seller really owns the plot: allotment or transfer file, CNIC, no dues or disputes',
          'Ask the society office for a dues clearance and confirm the plot number and size on the ground',
          'Visit the plot and look at levels, neighbours already built, and drainage',
        ],
        links: [
          { label: 'Check ground reports', href: '/construction-estimate#ground-check' },
          { label: 'Report what you found', href: '/report-ground' },
          { label: 'Check a society', href: '/browse' },
        ],
        added: true,
      },
      {
        id: 'transfer',
        title: 'Complete the plot transfer',
        summary: 'Every society runs its own transfer process. Get the checklist from the society office before you start.',
        tasks: [
          'Ask the society for its bylaws and its transfer checklist: which forms, who must attend, and which documents',
          'Note the head office location, its working days and hours, and who handles transfers',
          'Get the full fee list in writing: society transfer fee, membership or other charges, and any outstanding dues',
          'Confirm the government taxes and stamp duty that apply to a transfer today, and how and where to pay them',
          'Pay through the official channel and keep every receipt',
        ],
      },
      {
        id: 'possession',
        title: 'Receive the NDC and the possession letter',
        summary: 'These two papers prove the plot is yours and that you can start work.',
        tasks: [
          'Collect the No Demand Certificate (NDC) showing nothing is owed',
          'Collect the transfer or allotment letter in your name and the possession letter',
          'Have the society confirm the plot boundaries on site (demarcation) and take photos',
          'Keep certified copies of everything in one folder',
        ],
      },
    ],
  },
  {
    key: 'DESIGN',
    title: 'Design, approve and price',
    color: '#4f46e5',
    tint: '#eef2ff',
    ink: '#312e81',
    steps: [
      {
        id: 'architect',
        title: 'Go to an architect',
        summary: 'Start from ready house plans for your plot size, or have an architect design one for you.',
        tasks: ['Share your plot size, family needs and budget', 'Check the society bylaws for covered area, setbacks and height limits'],
        links: [{ label: 'Browse house plans', href: '/house-plans' }],
      },
      {
        id: 'map-approval',
        title: 'Finalise the map and elevation, then get it approved',
        summary: 'No construction should start without an approved map.',
        tasks: [
          'Finalise floor plans, elevation and sections',
          'Submit to the society first, then to the development authority that applies to you (CDA, RDA or LDA)',
          'Pay the approval fees and keep the stamped approved map',
        ],
        links: [{ label: 'Estimate approval costs', href: '/construction-estimate' }],
      },
      {
        id: 'boq',
        title: 'Get your material and cost estimate (BOQ)',
        summary: 'Turn the drawings into quantities and a budget, including a contingency.',
        tasks: ['Enter your plot size and floors in the estimator', 'Review materials, labour and the step-by-step budget', 'Keep a contingency for price changes'],
        links: [{ label: 'Estimate build cost', href: '/construction-estimate' }],
      },
      {
        id: 'soil-structure',
        title: 'Soil test, structural drawings, and the society vetting fee',
        summary: 'The soil report decides the foundation, and the structural drawings must be vetted before you build.',
        tasks: [
          'Do the soil test (boring) on your own plot, not a neighbour’s',
          'Have the structural engineer design the foundation and structure from the soil report',
          'Get the detailed drawings: structural, electrical, plumbing',
          'Pay the vetting fee and submit the drawings and the soil report to the society office',
        ],
        links: [{ label: 'Check ground reports', href: '/construction-estimate#ground-check' }],
        added: true,
      },
    ],
  },
  {
    key: 'PREPARE',
    title: 'Hire and prepare',
    color: '#16a34a',
    tint: '#f0fdf4',
    ink: '#14532d',
    steps: [
      {
        id: 'contractor',
        title: 'Hire a contractor',
        summary: 'Compare verified builders and agree the scope in writing.',
        tasks: [
          'Ask for past projects and visit one',
          'Sign a written contract: scope, price, payment milestones, timeline and who supplies materials',
          'Tie payments to finished work, not to dates',
        ],
        links: [{ label: 'Find contractors', href: '/contractors' }],
      },
      {
        id: 'suppliers',
        title: 'Find suppliers',
        summary: 'Compare materials and daily rates for cement, steel, bricks, sand and crush.',
        tasks: ['Get written quotes from at least 2 suppliers', 'Check brands, delivery charges and credit terms'],
        links: [{ label: 'Find suppliers', href: '/suppliers' }],
      },
      {
        id: 'site-start',
        title: 'Set up the site and notify the society',
        summary: 'Get the plot ready and make sure the society allows work to begin.',
        tasks: [
          'Pay any construction deposit and collect the permission to start from the society',
          'Fence the plot, arrange water and a temporary electricity connection, and a safe store for materials',
          'Fix a site supervisor and a daily or weekly progress check',
        ],
        added: true,
      },
    ],
  },
  {
    key: 'BUILD',
    title: 'Build',
    color: '#d97706',
    tint: '#fffbeb',
    ink: '#78350f',
    steps: [
      {
        id: 'build',
        title: 'Build, step by step',
        summary: 'Follow the site order below. Pay for each step only when it is finished and checked.',
        tasks: [],
        links: [
          { label: 'Contractors', href: '/contractors' },
          { label: 'Suppliers', href: '/suppliers' },
          { label: 'Full cost roadmap', href: '/construction-estimate' },
        ],
      },
    ],
  },
  {
    key: 'FINISH',
    title: 'Complete and hand over',
    color: '#be123c',
    tint: '#fff1f2',
    ink: '#881337',
    steps: [
      {
        id: 'as-built',
        title: 'Final drawings and building inspection',
        summary: 'The society needs proof that the house was built as approved.',
        tasks: [
          'Ask your architect for the final (as-built) drawings',
          'Have the building inspector check the house against the approved map',
          'Fix anything the inspector points out',
        ],
        links: [{ label: 'Browse house plans', href: '/house-plans' }],
      },
      {
        id: 'completion',
        title: 'Submit completion at the society office',
        summary: 'Closing the file with the society protects you when you sell or rent.',
        tasks: [
          'Submit the completion papers and inspection report to the society office',
          'Collect the completion certificate and ask for any construction deposit back',
          'Apply for the permanent electricity, gas and water connections',
        ],
        added: true,
      },
      {
        id: 'move-in',
        title: 'Final snag check and move in',
        summary: 'Walk through every room with your contractor before the last payment.',
        tasks: ['List every defect and have each one fixed', 'Keep warranties, bills and drawings in one folder', 'Pay the final instalment when the list is clear'],
        added: true,
      },
    ],
  },
];

export const JOURNEY_STEP_COUNT = BUILD_JOURNEY.reduce((n, s) => n + s.steps.length, 0);
