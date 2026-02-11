// ═══════════════════════════════════════════════════════════════════
// PRESCRIPTIVE DEAL GUIDANCE - Challenger-MEDDPICC Sales Coach
// ═══════════════════════════════════════════════════════════════════

// MEDDPICC Field Definitions with coaching
const MEDDPICC = {
  metrics: {
    label: 'Metrics',
    letter: 'M',
    question: 'What quantifiable outcomes will they achieve?',
    examples: 'Reduce readmissions by 15%, Cut AI pilot-to-production time by 50%',
    coaching: 'Without clear metrics, the deal lacks urgency. Ask: "What would success look like in numbers?"'
  },
  economic_buyer: {
    label: 'Economic Buyer',
    letter: 'E',
    question: 'Who controls the budget and can sign?',
    examples: 'CFO, VP Finance, CIO with budget authority',
    coaching: 'If you do not have access to the economic buyer, you are not in control of this deal.'
  },
  decision_criteria: {
    label: 'Decision Criteria',
    letter: 'D',
    question: 'What factors will they evaluate solutions on?',
    examples: 'Price, integration ease, compliance, time-to-value, vendor stability',
    coaching: 'You must know their criteria to position FORGE correctly. Ask: "What will you be comparing when making this decision?"'
  },
  decision_process: {
    label: 'Decision Process',
    letter: 'D',
    question: 'What steps do they take to make a decision?',
    examples: 'Committee review → CFO approval → Legal → Procurement',
    coaching: 'Map every step and stakeholder. Deals stall when you discover new steps late.'
  },
  paper_process: {
    label: 'Paper Process',
    letter: 'P',
    question: 'What is required to get a contract signed?',
    examples: '3 quotes required, legal redlines, insurance cert, vendor registration',
    coaching: 'Start this early. Paper process is where deals go to die.'
  },
  identified_pain: {
    label: 'Identified Pain',
    letter: 'I',
    question: 'What specific problem are we solving?',
    examples: 'Stuck in pilot purgatory, governance gaps, no AI strategy alignment',
    coaching: 'No pain = no deal. If they are not actively hurting, this is not a real opportunity.'
  },
  champion: {
    label: 'Champion',
    letter: 'C',
    question: 'Who inside is selling for you when you are not in the room?',
    examples: 'Dr. Mike Chen (CMO) - personally invested in AI success',
    coaching: 'A true champion has power, influence, and personal stake in your success.'
  },
  competition: {
    label: 'Competition',
    letter: 'C',
    question: 'Who else are they considering?',
    examples: 'IBM Watson, Internal IT team, Big 4 consultants, Status quo',
    coaching: 'Status quo is your biggest competitor. Quantify the cost of doing nothing.'
  }
};

// Challenger Sale Stages with prescriptive actions
const CHALLENGER_STAGES = {
  outreach: {
    label: 'Outreach',
    objective: 'Get their attention and earn a meeting',
    actions: [
      'Research the organization deeply (recent news, strategic initiatives, pain points)',
      'Find a warm connection path (LinkedIn, conferences, mutual contacts)',
      'Lead with insight, not product pitch - teach them something they did not know',
      'Personalize: reference their specific challenges (pilot purgatory, governance gaps)'
    ],
    nextStageRequires: 'Meeting scheduled with decision-influencer or higher'
  },
  teach: {
    label: 'Teach',
    objective: 'Reframe their thinking and establish credibility',
    actions: [
      'Deliver commercial insight that challenges their assumptions',
      'Show them a problem they did not know they had (Challenger approach)',
      'Quantify the cost of their current state (pilot purgatory costs)',
      'Position FORGE as uniquely able to solve this newly-revealed problem'
    ],
    nextStageRequires: 'They acknowledge the problem and want to explore solutions'
  },
  qualify: {
    label: 'Qualify',
    objective: 'Determine if this is a real opportunity worth pursuing',
    actions: [
      'Identify the Economic Buyer - who controls budget?',
      'Understand their timeline and urgency',
      'Confirm budget exists or can be created (fiscal year timing)',
      'Map the Decision Process - every step and stakeholder'
    ],
    nextStageRequires: 'MEDDPICC: M, E, D, P, I fields populated'
  },
  expand: {
    label: 'Expand',
    objective: 'Build consensus and expand your influence',
    actions: [
      'Identify and develop a Champion who will sell internally',
      'Map all stakeholders and their individual priorities',
      'Address competition explicitly - why FORGE vs alternatives',
      'Tailor value messaging to each stakeholder role'
    ],
    nextStageRequires: 'Champion identified, multiple stakeholders engaged'
  },
  propose: {
    label: 'Propose',
    objective: 'Present a solution aligned to their buying criteria',
    actions: [
      'Confirm Decision Criteria are fully understood',
      'Present proposal that maps to their criteria point-by-point',
      'Include clear metrics and success measures',
      'Start Paper Process early - know what they need'
    ],
    nextStageRequires: 'Proposal delivered, verbal intent to proceed'
  },
  close: {
    label: 'Close',
    objective: 'Navigate to signed contract',
    actions: [
      'Drive Paper Process to completion - remove every obstacle',
      'Handle last-minute objections decisively',
      'Confirm implementation timeline and resources',
      'Get the signature - do not let momentum die'
    ],
    nextStageRequires: 'Signed contract'
  },
  won: {
    label: 'Won',
    objective: 'Deliver value and build reference',
    actions: [
      'Execute flawlessly on contracted scope',
      'Document wins and build case study',
      'Identify expansion opportunities',
      'Ask for referrals to peer organizations'
    ],
    nextStageRequires: 'N/A - Celebrate and deliver'
  }
};

// Generate prescriptive guidance based on deal state
function generateDealGuidance(deal) {
  const guidance = {
    urgentActions: [],
    warnings: [],
    meddpiccStatus: {},
    meddpiccScore: 0,
    stageGuidance: CHALLENGER_STAGES[deal.stage] || CHALLENGER_STAGES.outreach,
    nextBestAction: null
  };
  
  // Calculate days since last contact
  const lastContact = deal.updated_at ? new Date(deal.updated_at) : null;
  const daysSinceUpdate = lastContact ? Math.floor((new Date() - lastContact) / (1000*60*60*24)) : 999;
  
  // Check MEDDPICC completion
  let filled = 0;
  let total = 8;
  
  Object.keys(MEDDPICC).forEach(field => {
    const value = deal[field];
    const hasValue = value && value.trim().length > 0;
    guidance.meddpiccStatus[field] = {
      filled: hasValue,
      value: value,
      ...MEDDPICC[field]
    };
    if (hasValue) filled++;
  });
  
  guidance.meddpiccScore = Math.round((filled / total) * 100);
  
  // Generate warnings based on stage and missing data
  const stage = deal.stage;
  
  // Time-based warnings
  if (daysSinceUpdate > 14) {
    guidance.warnings.push({
      severity: 'critical',
      message: `No activity in ${daysSinceUpdate} days - deal is going cold`,
      action: 'Reach out TODAY with a value-add touchpoint'
    });
  } else if (daysSinceUpdate > 7) {
    guidance.warnings.push({
      severity: 'high',
      message: `${daysSinceUpdate} days since last update`,
      action: 'Schedule next touchpoint this week'
    });
  }
  
  // Stage-specific missing field warnings
  if (['qualify', 'expand', 'propose', 'close'].includes(stage)) {
    if (!deal.economic_buyer) {
      guidance.warnings.push({
        severity: 'critical',
        message: 'No Economic Buyer identified',
        action: 'Ask your champion: "Who ultimately signs off on this budget?"'
      });
    }
    if (!deal.identified_pain) {
      guidance.warnings.push({
        severity: 'critical', 
        message: 'Pain not documented',
        action: 'You cannot close a deal without clear pain. Revisit discovery.'
      });
    }
  }
  
  if (['expand', 'propose', 'close'].includes(stage)) {
    if (!deal.champion) {
      guidance.warnings.push({
        severity: 'high',
        message: 'No Champion identified',
        action: 'Who is selling for you when you are not in the room? Find and develop them.'
      });
    }
    if (!deal.decision_criteria) {
      guidance.warnings.push({
        severity: 'high',
        message: 'Decision Criteria unknown',
        action: 'Ask: "What factors will you evaluate when making this decision?"'
      });
    }
  }
  
  if (['propose', 'close'].includes(stage)) {
    if (!deal.paper_process) {
      guidance.warnings.push({
        severity: 'medium',
        message: 'Paper Process not mapped',
        action: 'Ask: "What does your organization require to get a contract signed?"'
      });
    }
    if (!deal.metrics) {
      guidance.warnings.push({
        severity: 'medium',
        message: 'Success metrics not defined',
        action: 'Quantify expected outcomes - this strengthens the business case'
      });
    }
  }
  
  // Determine Next Best Action
  if (guidance.warnings.find(w => w.severity === 'critical')) {
    guidance.nextBestAction = guidance.warnings.find(w => w.severity === 'critical');
  } else if (daysSinceUpdate > 7) {
    guidance.nextBestAction = {
      message: 'Time for a touchpoint',
      action: deal.next_action || guidance.stageGuidance.actions[0]
    };
  } else if (!deal.next_action) {
    guidance.nextBestAction = {
      message: 'No next action defined',
      action: 'Set a specific next action with a date'
    };
  } else {
    guidance.nextBestAction = {
      message: 'Execute your next action',
      action: deal.next_action
    };
  }
  
  return guidance;
}

// Export for use in main app
window.MEDDPICC = MEDDPICC;
window.CHALLENGER_STAGES = CHALLENGER_STAGES;
window.generateDealGuidance = generateDealGuidance;
