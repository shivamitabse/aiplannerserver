const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const { Resend } = require('resend');
const { performAudit } = require('../auditEngine');
const { getDbConnection } = require('../db');

const router = express.Router();

// Initialize APIs if keys are available
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

// POST /api/audit
router.post('/audit', (req, res) => {
  try {
    const { tools, teamSize, primaryUseCase } = req.body;
    
    if (!tools || tools.length === 0) {
      return res.status(400).json({ error: 'Tools are required' });
    }

    const auditResult = performAudit({ tools, teamSize, primaryUseCase });

    res.json(auditResult);
  } catch (error) {
    console.error('Audit Error:', error);
    res.status(500).json({ error: 'Failed to perform audit' });
  }
});

// POST /api/summary
router.post('/summary', async (req, res) => {
  try {
    const { teamSize, tools, auditResults } = req.body;
    
    let summary = '';
    
    if (openai) {
      try {
        const prompt = `You are an AI spend optimization consultant. Analyze this team's AI stack:\nTeam Size: ${teamSize}\nTools: ${JSON.stringify(tools)}\n\nThey could save $${auditResults.totalMonthlySavings}/month.\nWrite a personalized, encouraging 100-word summary addressing their stack efficiency.`;
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150
        });
        
        summary = response.choices[0].message.content.trim();
      } catch (aiError) {
        console.error('OpenAI Error:', aiError);
        summary = `Your team of ${teamSize} has potential savings of $${auditResults.totalMonthlySavings}/mo. Review the recommendations below to optimize your AI stack.`;
      }
    } else {
      summary = `Your team of ${teamSize} has potential savings of $${auditResults.totalMonthlySavings}/mo. Review the recommendations below to optimize your AI stack.`;
    }

    res.json({ summary });
  } catch (error) {
    console.error('Summary Error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// POST /api/lead
router.post('/lead', async (req, res) => {
  try {
    const { email, company, role, auditData, summary } = req.body;

    const reportId = uuidv4();
    const db = await getDbConnection();

    // Save lead
    await db.query(
      'INSERT INTO leads (report_id, email, company, role) VALUES ($1, $2, $3, $4)',
      [reportId, email, company, role]
    );

    // Save audit
    await db.query(
      'INSERT INTO audits (report_id, data, summary, recommendations, total_monthly_savings, total_annual_savings) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        reportId,
        JSON.stringify(auditData.inputData),
        summary || '',
        JSON.stringify(auditData.auditResults.recommendations),
        auditData.auditResults.totalMonthlySavings,
        auditData.auditResults.totalAnnualSavings
      ]
    );

    // Send Email
    if (resend) {
      try {
        const reportUrl = `${process.env.FRONTEND_URL}/audit/${reportId}`;
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Your AI Spend Audit Report',
          html: `<h1>Your AI Spend Audit is ready!</h1>
                 <p>You can view your full report and recommendations here: <a href="${reportUrl}">${reportUrl}</a></p>
                 <p>Potential Monthly Savings: $${auditData.auditResults.totalMonthlySavings}</p>
                 <p>Potential Annual Savings: $${auditData.auditResults.totalAnnualSavings}</p>`
        });
      } catch (emailError) {
        console.error('Resend Error:', emailError);
      }
    }

    res.json({ success: true, reportId });
  } catch (error) {
    console.error('Lead Error:', error);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// GET /api/report/:id
router.get('/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDbConnection();
    
    const result = await db.query('SELECT * FROM audits WHERE report_id = $1', [id]);
    const audit = result.rows[0];
    
    if (!audit) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      data: JSON.parse(audit.data),
      summary: audit.summary,
      recommendations: JSON.parse(audit.recommendations),
      totalMonthlySavings: audit.total_monthly_savings,
      totalAnnualSavings: audit.total_annual_savings,
      createdAt: audit.created_at
    });
  } catch (error) {
    console.error('Report fetching error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

module.exports = router;
