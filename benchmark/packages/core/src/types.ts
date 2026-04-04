// ============================================================
// TOKEN CLASSIFICATION — FIVE CATEGORIES
// ============================================================

export enum TokenCategory {
  CONTENT_TRANSFER = 'CONTENT_TRANSFER',
  MECHANISM_OVERHEAD = 'MECHANISM_OVERHEAD',
  COORDINATION_INSTRUCTIONS = 'COORDINATION_INSTRUCTIONS',
  TASK_REASONING = 'TASK_REASONING',
  SYSTEM_IDENTITY = 'SYSTEM_IDENTITY',
}

export const INTER_AGENT_CATEGORIES = [
  TokenCategory.CONTENT_TRANSFER,
  TokenCategory.MECHANISM_OVERHEAD,
  TokenCategory.COORDINATION_INSTRUCTIONS,
] as const;

export const AGENT_AUTONOMOUS_CATEGORIES = [
  TokenCategory.TASK_REASONING,
  TokenCategory.SYSTEM_IDENTITY,
] as const;

export interface TokenClassification {
  contentTransfer: { input: number; output: number };
  mechanismOverhead: { input: number; output: number };
  coordinationInstructions: { input: number; output: number };
  taskReasoning: { input: number; output: number };
  systemIdentity: { input: number; output: number };
}

// ============================================================
// TOKEN TRACKING
// ============================================================

export enum RunType {
  SINGLE_AGENT = 'SINGLE_AGENT',
  MESSAGE_PASSING = 'MESSAGE_PASSING',
  STIGMERGY = 'STIGMERGY',
}

export interface TokenUsageRecord {
  id: string;
  runId: string;
  trialIndex: number;
  agentId: string;
  requestId: string;
  category: TokenCategory;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  provider: string;
  model: string;
  timestamp: number;
  runType: RunType;
  cacheHit: boolean;
}

// ============================================================
// LLM TYPES
// ============================================================

export interface LLMProviderConfig {
  type: 'anthropic' | 'openai' | 'mock';
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens: number;
  temperature: number;
  context: RunContext;
}

export interface CompletionResponse {
  content: ContentBlock[];
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  stopReason: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface RunContext {
  runType: RunType;
  runId: string;
  trialIndex: number;
  agentId: string;
}

// ============================================================
// AGENT TYPES
// ============================================================

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  provider: LLMProviderConfig;
  baseSystemPrompt: string;
}

// ============================================================
// TASK TYPES
// ============================================================

export enum TaskCategory {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  ITERATIVE = 'ITERATIVE',
  MIXED = 'MIXED',
}

export enum TaskDifficulty {
  SIMPLE = 'SIMPLE',
  MEDIUM = 'MEDIUM',
  COMPLEX = 'COMPLEX',
}

export interface TaskStep {
  id: string;
  agentRole: string;
  description: string;
  dependsOn: string[];
  expectedOutputTokenRange: [number, number];
}

export interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  difficulty: TaskDifficulty;
  agentCount: number;
  steps: TaskStep[];
  expectedCoordinationPoints: number;
  userPrompt: string;
  singleAgentPrompt: string;
  crossoverTask: boolean;
  equivalenceMargin: number;
}

// ============================================================
// PER-TRIAL RESULT TYPES
// ============================================================

export interface RunResult {
  runType: RunType;
  runId: string;

  contentTransferTokens: number;
  mechanismOverheadTokens: number;
  coordinationInstructionsTokens: number;
  taskReasoningTokens: number;
  systemIdentityTokens: number;

  interAgentTokens: number;
  agentAutonomousTokens: number;
  totalTokens: number;

  cachedTokens: number;
  effectiveTokens: number;
  cacheHitRate: number;

  wallClockMs: number;
  agentCount: number;
  apiCallCount: number;
  success: boolean;
  output: unknown;
  tokenLog: TokenUsageRecord[];
}

export interface TrialCrossValidation {
  classifierDriftB: number;
  classifierDriftC: number;
  expectedInterAgentB: number;
  classifiedInterAgentB: number;
  expectedInterAgentC: number;
  classifiedInterAgentC: number;
}

export interface TrialResult {
  trialIndex: number;
  comparisonId: string;
  singleAgent: RunResult;
  messagePassing: RunResult;
  stigmergy: RunResult;
  crossValidation: TrialCrossValidation;
}

export interface PerTrialMetrics {
  interAgentSavingsPercent: number;
  contentTransferSavingsPercent: number;
  totalSavingsPercent: number;
  effectiveSavingsPercent: number;
  mechanismOverheadCost: number;
  coordinationInstructionsDelta: number;
  decompositionOverheadB: number;
  decompositionOverheadC: number;
  autonomousFloor: number;
  wallClockDelta: number;
  apiCallDelta: number;
}

// ============================================================
// STATISTICAL RESULT TYPES
// ============================================================

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface DescriptiveStats {
  mean: number;
  median: number;
  stdDev: number;
  iqr: [number, number];
  cv: number;
  min: number;
  max: number;
  n: number;
  ci: ConfidenceInterval;
}

export interface HypothesisTestResult {
  testName: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  interpretation: string;
}

export interface CategoryVarianceProfile {
  contentTransfer: DescriptiveStats;
  mechanismOverhead: DescriptiveStats;
  coordinationInstructions: DescriptiveStats;
  taskReasoning: DescriptiveStats;
  systemIdentity: DescriptiveStats;
}

export enum ReportingLevel {
  RAW_ONLY = 'RAW_ONLY',
  PROVISIONAL = 'PROVISIONAL',
  PRELIMINARY = 'PRELIMINARY',
  FULL = 'FULL',
  PUBLICATION = 'PUBLICATION',
}

export interface CrossValidationCalibration {
  runAVarianceCV: number;
  calibratedThreshold: number;
  perTrialDriftsB: number[];
  perTrialDriftsC: number[];
  flaggedTrialsB: number[];
  flaggedTrialsC: number[];
  overallReliable: boolean;
}

export interface AggregatedStats {
  trialCount: number;
  reportingLevel: ReportingLevel;

  interAgentSavings: DescriptiveStats;
  contentTransferSavings: DescriptiveStats;
  totalSavings: DescriptiveStats;
  effectiveSavings: DescriptiveStats;

  mechanismOverheadCost: DescriptiveStats;
  coordinationInstructionsDelta: DescriptiveStats;

  autonomousFloor: DescriptiveStats;
  decompositionOverheadB: DescriptiveStats;
  decompositionOverheadC: DescriptiveStats;

  varianceProfileA: CategoryVarianceProfile;
  varianceProfileB: CategoryVarianceProfile;
  varianceProfileC: CategoryVarianceProfile;

  interAgentTest: HypothesisTestResult | null;
  totalSavingsTest: HypothesisTestResult | null;
  equivalenceTest: HypothesisTestResult | null;

  wallClockSavings: DescriptiveStats;
  apiCallDelta: DescriptiveStats;
  cacheHitRateC: DescriptiveStats;
}

export interface ComparisonConfig {
  trialCount: number;
  provider: string;
  model: string;
  temperature: number;
  promptCachingEnabled: boolean;
  skipSingleAgent: boolean;
}

export interface ComparisonResult {
  id: string;
  taskId: string;
  taskName: string;
  timestamp: number;
  config: ComparisonConfig;
  trials: TrialResult[];
  stats: AggregatedStats;
  crossValidationCalibration: CrossValidationCalibration;
}
