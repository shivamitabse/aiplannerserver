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

// Store in-memory cache for recent audits before they are claimed by a lead
const auditCache = new Map();

// POST /api/audit
router.post('/audit', (req, res) => {
  try {
    const { tools, teamSize, primaryUseCase } = req.body;
    
    if (!tools || tools.length === 0) {
      return res.status(400).json({ error: 'Tools are required' });
    }

    const auditResult = performAudit({ tools, teamSize, primaryUseCase });
    
    // Generate a temporary ID for this audit session
    const tempId = uuidv4();
    auditCache.set(tempId, {
      requestData: { tools, teamSize, primaryUseCase },
      auditResult: auditResult,
      timestamp: Date.now()
    });

    res.json({
      auditId: tempId,
      ...auditResult
    });
  } catch (error) {
    console.error('Audit Error:', error);
    res.status(500).json({ error: 'Failed to perform audit' });
  }
});

// POST /api/summary
router.post('/summary', async (req, res) => {
  try {
    const { auditId } = req.body;
    const session = auditCache.get(auditId);
    
    if (!session) {
      return res.status(404).json({ error: 'Audit session not found' });
    }

    let summary = '';
    
    if (openai) {
      try {
        const prompt = `You are an AI spend optimization consultant. Analyze this team's AI stack:\nTeam Size: ${session.requestData.teamSize}\nUse Case: ${session.requestData.primaryUseCase}\nTools: ${JSON.stringify(session.requestData.tools)}\n\nThey could save $${session.auditResult.totalMonthlySavings}/month.\nWrite a personalized, encouraging 100-word summary addressing their stack efficiency.`;
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150
        });
        
        summary = response.choices[0].message.content.trim();
      } catch (aiError) {
        console.error('OpenAI Error:', aiError);
        summary = `Your team of ${session.requestData.teamSize} has potential savings of $${session.auditResult.totalMonthlySavings}/mo. Review the recommendations below to optimize your AI stack.`;
      }
    } else {
      summary = `Your team of ${session.requestData.teamSize} has potential savings of $${session.auditResult.totalMonthlySavings}/mo. Review the recommendations below to optimize your AI stack.`;
    }

    // Update cache with summary
    session.summary = summary;
    auditCache.set(auditId, session);

    res.json({ summary });
  } catch (error) {
    console.error('Summary Error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// POST /api/lead
router.post('/lead', async (req, res) => {
  try {
    const { auditId, email, company, role } = req.body;
    const session = auditCache.get(auditId);

    if (!session) {
      return res.status(404).json({ error: 'Audit session not found' });
    }

    const reportId = uuidv4();
    const db = await getDbConnection();

    // Save lead
    await db.run(
      'INSERT INTO leads (report_id, email, company, role) VALUES (?, ?, ?, ?)',
      [reportId, email, company, role]
    );

    // Save audit
    await db.run(
      'INSERT INTO audits (report_id, data, summary, recommendations, total_monthly_savings, total_annual_savings) VALUES (?, ?, ?, ?, ?, ?)',
      [
        reportId,
        JSON.stringify(session.requestData),
        session.summary || '',
        JSON.stringify(session.auditResult.recommendations),
        session.auditResult.totalMonthlySavings,
        session.auditResult.totalAnnualSavings
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
                 <p>Potential Monthly Savings: $${session.auditResult.totalMonthlySavings}</p>
                 <p>Potential Annual Savings: $${session.auditResult.totalAnnualSavings}</p>`
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
    
    const audit = await db.get('SELECT * FROM audits WHERE report_id = ?', [id]);
    
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
