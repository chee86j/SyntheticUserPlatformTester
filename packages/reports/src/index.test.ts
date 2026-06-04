import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRunReportMarkdown, generateRunReportPdf } from './index.js';

test('generateRunReportMarkdown produces required sections and redacts sensitive values', () => {
  const markdown = generateRunReportMarkdown({
    generatedAt: new Date('2026-06-01T12:00:00.000Z'),
    run: {
      id: 'run-123',
      status: 'FAILED',
      createdAt: '2026-06-01T11:55:00.000Z',
      startedAt: '2026-06-01T11:56:00.000Z',
      finishedAt: '2026-06-01T11:59:00.000Z',
      requestedAgentCount: 2,
      maxRunDurationSeconds: 300,
      project: { name: 'Core Validation' },
      environment: { name: 'staging', baseUrl: 'https://app.example.local/login?token=abc123', type: 'STAGING' },
      workflow: {
        name: 'Sign In and Dashboard',
        goal: 'User signs in and reaches dashboard',
        startingPath: '/login',
        workflowType: 'GOAL_BASED',
        maxSteps: 40,
        maxDurationSeconds: 300,
        successCriteria: [{ type: 'URL_CONTAINS', value: '/dashboard' }]
      },
      budgetPolicy: {
        name: 'Default Budget',
        maxCostPerRun: 50,
        maxTokensPerRun: 100000,
        maxActionsPerAgent: 50,
        maxDurationPerRunSeconds: 900
      }
    },
    personas: [
      {
        id: 'persona-1',
        name: 'Clinical Specialist',
        role: 'Nurse Practitioner',
        industry: 'Healthcare',
        technicalProficiency: 40,
        patience: 35,
        timePressure: 80,
        accessibilityNeeds: ['high contrast']
      }
    ],
    agents: [
      { id: 'agent-1', personaId: 'persona-1', testAccountId: 'acct-1', status: 'FAILED', startedAt: null, finishedAt: null }
    ],
    events: [
      {
        id: 'event-1',
        agentId: 'agent-1',
        personaId: 'persona-1',
        eventType: 'action.failed',
        severity: 'ERROR',
        payload: { error: 'Password invalid', password: 'SuperSecret!', frustrationScore: 80 },
        timestamp: '2026-06-01T11:58:00.000Z'
      },
      {
        id: 'event-2',
        agentId: 'agent-1',
        personaId: 'persona-1',
        eventType: 'workflow.failed',
        severity: 'ERROR',
        payload: { reason: 'Bearer abc123xyz' },
        timestamp: '2026-06-01T11:59:00.000Z'
      }
    ],
    artifacts: [
      {
        id: 'artifact-1',
        type: 'REPORT',
        uri: 'C:\\repo\\runs\\run-123\\report.md?token=abc123',
        createdAt: '2026-06-01T12:00:00.000Z'
      }
    ],
    llmUsage: [
      {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.0123,
        agentId: 'agent-1'
      }
    ],
    budgetSummary: {
      totals: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.0123 },
      remaining: { cost: 49.9877, tokens: 99850 },
      projected: { next1000TokensCost: 0.082 }
    }
  });

  assert.match(markdown, /## 1\. Executive Summary/);
  assert.match(markdown, /## 11\. Appendix: Event Summary/);
  assert.match(markdown, /Top Findings/);
  assert.doesNotMatch(markdown, /SuperSecret!/);
  assert.doesNotMatch(markdown, /abc123xyz/);
  assert.match(markdown, /\[redacted\]/);
  assert.doesNotMatch(markdown, /\?token=/);
});

test('generateRunReportPdf renders a PDF from the markdown source of truth', async () => {
  const markdown = [
    '# Post-Run Report',
    '',
    '- Generated: 2026-06-03T12:00:00.000Z',
    '- Status: Completed',
    '',
    '## 1. Executive Summary',
    '',
    '- No secrets should appear here: password=[redacted], bearer [redacted]',
    '',
    '## 2. Artifacts',
    '',
    '| Type | URI |',
    '| --- | --- |',
    '| REPORT | runs/example/report.md |'
  ].join('\n');

  const pdf = await generateRunReportPdf(markdown);

  assert.ok(pdf.length > 500);
  assert.equal(pdf.subarray(0, 4).toString('utf8'), '%PDF');
  const pdfText = pdf.toString('latin1');
  assert.match(pdfText, /Synthetic User Validation Report/);
  assert.doesNotMatch(pdfText, /SuperSecret!/);
  assert.doesNotMatch(pdfText, /Bearer abc123xyz/);
});
