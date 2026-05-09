import { describe, it, expect } from 'vitest';
import auditEngine from '../auditEngine.js';
const { performAudit } = auditEngine;

describe('Audit Engine', () => {
  it('should recommend downgrade for small teams on expensive plans', () => {
    const result = performAudit({
      teamSize: 5,
      primaryUseCase: 'coding',
      tools: [
        { name: 'GitHub Copilot', plan: 'Enterprise', seats: 5, monthlySpend: 195 }
      ]
    });

    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].message).toContain('Downgrading');
    expect(result.totalMonthlySavings).toBeGreaterThan(0);
  });

  it('should flag redundant chat assistants', () => {
    const result = performAudit({
      teamSize: 15,
      primaryUseCase: 'mixed',
      tools: [
        { name: 'ChatGPT', plan: 'Plus', seats: 5, monthlySpend: 100 },
        { name: 'Claude', plan: 'Pro', seats: 5, monthlySpend: 100 }
      ]
    });

    const hasConsolidateRec = result.recommendations.some(r => r.message.includes('consolidating'));
    expect(hasConsolidateRec).toBe(true);
    expect(result.totalMonthlySavings).toBeGreaterThan(0);
  });

  it('should not complain if the stack is fully optimized', () => {
    const result = performAudit({
      teamSize: 50,
      primaryUseCase: 'mixed',
      tools: [
        { name: 'ChatGPT', plan: 'Team', seats: 50, monthlySpend: 1500 }
      ]
    });

    expect(result.recommendations.length).toBe(0);
    expect(result.totalMonthlySavings).toBe(0);
  });

  it('should flag excessive API spending', () => {
    const result = performAudit({
      teamSize: 10,
      primaryUseCase: 'coding',
      tools: [
        { name: 'OpenAI API', plan: 'Pay-as-you-go', seats: 1, monthlySpend: 800 }
      ]
    });

    const hasApiRec = result.recommendations.some(r => r.message.includes('API spending is quite high'));
    expect(hasApiRec).toBe(true);
    expect(result.totalMonthlySavings).toBe(160); // 20% of 800
  });
});
