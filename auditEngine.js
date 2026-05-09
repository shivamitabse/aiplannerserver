const PRICING_DATA = {
  'Cursor': { Pro: 20, Business: 40 },
  'GitHub Copilot': { Individual: 10, Business: 19, Enterprise: 39 },
  'Claude': { Pro: 20, Team: 30 },
  'ChatGPT': { Plus: 20, Team: 30, Enterprise: 60 },
  'Anthropic API': { 'Pay-as-you-go': 0 },
  'OpenAI API': { 'Pay-as-you-go': 0 },
  'Gemini': { Advanced: 20 },
  'Windsurf': { Pro: 20 }
};

function performAudit(userData) {
  const { teamSize, primaryUseCase, tools } = userData;
  const recommendations = [];
  let totalMonthlySavings = 0;

  const activeToolNames = tools.map(t => t.name);

  tools.forEach(tool => {
    const { name, plan, seats, monthlySpend } = tool;
    const currentSpend = Number(monthlySpend);
    const costPerSeat = currentSpend / seats;

    // Rule 1: Expensive plan downgrade for small teams or high cost per seat
    if (!name.includes('API') && teamSize <= 20 && (plan.toLowerCase().includes('enterprise') || plan.toLowerCase().includes('business') || costPerSeat > 30)) {
      let optimalPlan = 'Pro/Team';
      let optimalCostPerSeat = 20;

      if (PRICING_DATA[name]) {
        if (PRICING_DATA[name]['Pro']) {
          optimalPlan = 'Pro';
          optimalCostPerSeat = PRICING_DATA[name]['Pro'];
        } else if (PRICING_DATA[name]['Team']) {
          optimalPlan = 'Team';
          optimalCostPerSeat = PRICING_DATA[name]['Team'];
        } else if (PRICING_DATA[name]['Plus']) {
          optimalPlan = 'Plus';
          optimalCostPerSeat = PRICING_DATA[name]['Plus'];
        } else if (PRICING_DATA[name]['Individual']) {
          optimalPlan = 'Individual';
          optimalCostPerSeat = PRICING_DATA[name]['Individual'];
        }
      }

      const optimalSpend = optimalCostPerSeat * seats;
      const savings = currentSpend - optimalSpend;

      if (savings > 0) {
        recommendations.push({
          tool: name,
          message: `Your team size (${teamSize}) doesn't strictly require the ${plan} tier. Downgrading to the ${optimalPlan} plan (${optimalCostPerSeat}/seat) will save you money without losing significant core functionality.`,
          savings: savings
        });
        totalMonthlySavings += savings;
      }
    }

    // Rule 2: Redundant Chat Assistants
    const chatTools = ['ChatGPT', 'Claude', 'Gemini'];
    if (chatTools.includes(name)) {
      const otherChatTools = chatTools.filter(t => t !== name && activeToolNames.includes(t));
      if (otherChatTools.length > 0) {
        // Flag redundancy
        const hasProcessed = recommendations.some(r => r.message.includes('consolidating') && r.message.includes(name));
        if (!hasProcessed) {
          recommendations.push({
            tool: name,
            message: `You are paying for multiple general chat assistants (${name} and ${otherChatTools.join(', ')}). Consider consolidating to a single platform for your team.`,
            savings: currentSpend 
          });
          totalMonthlySavings += currentSpend;
        }
      }
    }

    // Rule 3: Redundant Coding Assistants
    const codingTools = ['Cursor', 'GitHub Copilot', 'Windsurf'];
    if (codingTools.includes(name)) {
      const otherCodingTools = codingTools.filter(t => t !== name && activeToolNames.includes(t));
      if (otherCodingTools.length > 0) {
        const hasProcessed = recommendations.some(r => r.message.includes('consolidating') && r.message.includes(name));
        if (!hasProcessed) {
          recommendations.push({
            tool: name,
            message: `You are using multiple AI coding assistants (${name} and ${otherCodingTools.join(', ')}). Most teams only need one. Consider standardizing on one tool.`,
            savings: currentSpend
          });
          totalMonthlySavings += currentSpend;
        }
      }
    }

    // Rule 4: Excessive API Spending
    if (name.includes('API') && currentSpend > 500) {
      recommendations.push({
        tool: name,
        message: `Your API spending is quite high ($${currentSpend}/mo). Consider optimizing your prompts, implementing semantic caching, or switching to smaller, cheaper models for simple tasks.`,
        savings: currentSpend * 0.2 
      });
      totalMonthlySavings += (currentSpend * 0.2);
    }
  });

  return {
    recommendations,
    totalMonthlySavings: totalMonthlySavings,
    totalAnnualSavings: totalMonthlySavings * 12
  };
}

module.exports = { performAudit };
