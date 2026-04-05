import { Router } from 'express';
import type { WebSocket } from 'ws';
import { RunType, type ComparisonConfig } from '@stigmergy-benchmark/core';
import { getTask } from '@stigmergy-benchmark/tasks';
import { ComparisonEngine } from '@stigmergy-benchmark/engine';
import { BenchmarkStore } from '@stigmergy-benchmark/storage';
import { MockLLMClient, AnthropicClient, OpenAIClient, RetryLLMClient, RateLimitedLLMClient } from '@stigmergy-benchmark/llm-client';
import type { LLMClient } from '@stigmergy-benchmark/llm-client';

/** Active WebSocket clients listening for live updates. */
const listeners = new Set<WebSocket>();

export function addWSListener(ws: WebSocket): void {
  listeners.add(ws);
  ws.on('close', () => listeners.delete(ws));
}

function broadcast(data: unknown): void {
  const msg = JSON.stringify(data);
  for (const ws of listeners) {
    if (ws.readyState === 1) { // OPEN
      ws.send(msg);
    }
  }
}

export function createLiveRoutes(store: BenchmarkStore): Router {
  const router = Router();

  router.post('/api/compare', async (req, res) => {
    const { taskId, config } = req.body as { taskId: string; config: Partial<ComparisonConfig> };

    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }

    let task;
    try {
      task = getTask(taskId);
    } catch {
      res.status(404).json({ error: `Task not found: ${taskId}` });
      return;
    }

    const fullConfig: ComparisonConfig = {
      trialCount: config?.trialCount ?? 10,
      provider: config?.provider ?? 'mock',
      model: config?.model ?? 'mock-model',
      temperature: config?.temperature ?? 0,
      promptCachingEnabled: config?.promptCachingEnabled ?? true,
      skipSingleAgent: config?.skipSingleAgent ?? false,
    };

    const client = createClient(fullConfig.provider);
    const engine = new ComparisonEngine(store, client);

    // Respond immediately with comparison ID
    const comparisonId = crypto.randomUUID();
    res.json({ comparisonId, status: 'started' });

    // Run comparison async, streaming events via WebSocket
    engine.runComparison(task, fullConfig, {
      onTrialStart(trialIndex, totalTrials) {
        broadcast({ type: 'trial_start', trialIndex, totalTrials });
      },
      onRunStart(trialIndex, runType) {
        broadcast({ type: 'run_start', trialIndex, runType });
      },
      onRunComplete(trialIndex, runType) {
        broadcast({ type: 'run_complete', trialIndex, runType });
      },
      onTrialComplete(trial, partialStats) {
        broadcast({ type: 'trial_complete', trialIndex: trial.trialIndex, partialStats });
      },
      onError(trialIndex, error) {
        broadcast({ type: 'error', trialIndex, message: error.message });
      },
    }).then(result => {
      broadcast({ type: 'complete', result });
    }).catch(err => {
      broadcast({ type: 'error', trialIndex: -1, message: String(err) });
    });
  });

  return router;
}

function createClient(provider: string): LLMClient {
  switch (provider) {
    case 'mock':
      return new MockLLMClient({ seed: 42, variance: 0.2 });
    case 'anthropic':
      return new RateLimitedLLMClient(new RetryLLMClient(new AnthropicClient()));
    case 'openai':
      return new RateLimitedLLMClient(new RetryLLMClient(new OpenAIClient()));
    default:
      return new MockLLMClient({ seed: 42, variance: 0.2 });
  }
}
