/**
 * Coordination instruction detection patterns.
 * These identify messages that direct inter-agent behavior.
 */
export const COORDINATION_PATTERNS: RegExp[] = [
  /\bagent\s+\w+\s+(should|please|needs?\s+to|will|must)\b/i,
  /\btask\s+(assignment|delegation|handoff|handover)\b/i,
  /\bcoordinate\s+with\b/i,
  /\byour\s+(role|responsibility|task|job)\s+is\b/i,
  /\bprevious\s+agent\s+(produced|found|generated|completed|wrote)\b/i,
  /\bpass\s+(this|the\s+results?|your\s+output)\s+to\b/i,
  /\bhand\s*off\s+to\b/i,
  /\breview\s+what\s+agent\s+\w+\s+(found|did|produced)\b/i,
  /\bcontinue\s+(from|where)\s+(agent|the\s+previous)\b/i,
  /\byou\s+are\s+agent\s+\d/i,
  /\bagent\s+\d+\s+of\s+\d+\b/i,
  /\buse\s+these?\s+tools?\s+in\s+order\b/i,
  /\bsense_and_claim\b/i,
  /\bdeposit_signal\b/i,
  /\bsense_environment\b/i,
  /\bdeposit_trace\b/i,
  /\breinforce_trace\b/i,
  /\bget_gradient\b/i,
  /\bcheck\s+the\s+(blackboard|environment|signals?)\b/i,
  /\bleave\s+a\s+(trace|signal)\b/i,
];

/**
 * Content transfer patterns — indicate work product being passed between agents.
 */
export const CONTENT_TRANSFER_PATTERNS: RegExp[] = [
  /\bhere\s+is\s+(the|my)\s+(output|result|analysis|findings|code|review)\b/i,
  /\bthe\s+following\s+(was|is)\s+(produced|generated|found)\s+by\b/i,
  /\bagent\s+\w+('s)?\s+(output|result|analysis|response)\s*:/i,
  /\b(previous|prior)\s+agent('s)?\s+(output|work|response)\b/i,
  /^```[\s\S]{200,}/m, // Large code blocks (likely work product)
];

/**
 * Tool definition marker — used to classify tool definitions as mechanism overhead.
 */
export const TOOL_DEFINITION_MARKER = '[tool-definitions]';

/**
 * MCP tool names used by stigmergy — their I/O is mechanism overhead.
 */
export const STIGMERGY_TOOL_NAMES = new Set([
  'deposit_trace',
  'sense_environment',
  'reinforce_trace',
  'get_gradient',
  'sense_and_claim',
  'deposit_signal',
  'store_artifact',
  'get_artifact',
]);
